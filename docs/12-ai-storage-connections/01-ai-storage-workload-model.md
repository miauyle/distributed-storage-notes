# AI Storage Workload Model：同一组存储机制，不同状态优先级

AI 工作负载没有废除对象身份、持久化、缓存与排队等存储问题。它改变的是：**谁消费数据、何时集中访问、丢失以后要付出什么代价，以及存储改善是否真正缩短计算等待。** 因此应先分类 Storage State，再选择路径和保护策略，不能从“用了 GPU”直接推导一种最佳存储架构。

本文是 Distributed Storage 模型到 Training / Inference Workload 的映射。通用机制继续由 [Object Model](../03-object-storage/01-object-model.md)、[Data Protection](../07-data-protection/README.md) 和 [Data Path / Performance](../09-data-path-performance/README.md) 维护，不展开模型算法、产品教程或面试材料。

## 1. 六类 State 不能用一种访问模式概括

下表是常见模式的通用归纳，不规定数据规模、文件格式或框架实现。Persistence Need 指满足所选业务与故障恢复目标所需的保留责任；Rebuildable 指是否可以从仍有效的输入重新形成所需状态，不代表代价低。

| State | Read / Write Pattern | Mutability | Sharing | Persistence Need | Latency Sensitivity | Rebuildable? |
| --- | --- | --- | --- | --- | --- | --- |
| Training Dataset | Read-heavy；多 Epoch 可重复读，也可流式或 shuffled / random access | 常见版本内不可变、版本间新增或 append-oriented；不是全部数据永不变 | 多 Worker / GPU 共享逻辑集合，实际读取范围可能不同 | 原始来源、版本与解释数据的材料通常需长期保存 | 供给不足影响 batch ready、step time；不只关注单 GET 延迟 | 有原始来源和处理流程时可重建；唯一采集数据未必可重建 |
| Model Weights | Read-mostly；启动、Model Load、Scale-out 集中读 | 已发布版本通常稳定，发布新版本替换逻辑引用 | 多 Worker / Replica 可能读相同内容，也可能读不同 shard | 部署所需版本应有可靠来源；节点副本可作缓存 | 对 model load time、服务就绪与弹性扩容敏感 | 有完整训练恢复状态或其他可信副本时可能重建；重新训练往往昂贵 |
| Checkpoint | 周期性、可能大规模并行写；失败后集中读 | 每个完成恢复点可保持稳定，新恢复点持续产生 | 多 Rank 共同形成、共同恢复一组状态 | 依恢复目标保留完整有效恢复点及依赖 | checkpoint pause、完成滞后与 restore time | 丢失最新点通常只能从较旧点重算进度，不保证精确复现 |
| Optimizer / Training State | 运行中频繁改变，保存时纳入 checkpoint，恢复时加载 | 随训练进度变化 | 可按 Rank 分片，属于同一逻辑训练边界 | 要续训到目标语义时，应保存所需部分；不要求每次内存更新都远端落盘 | 保存、staging 与恢复会影响训练暂停和重启 | 只有 weights 未必能还原其历史；从较旧完整点重新训练有成本 |
| Temporary / Intermediate Data | 依任务而定：scratch write、派生数据、临时读写 | 可短期变化 | 进程、节点或任务间共享，视依赖关系而定 | 可丢弃临时结果与必须保留的唯一中间结果应分开 | 阻塞下游时可能进入关键路径 | 保留输入和计算过程时常可重建，成本可能很高 |
| Inference KV Cache | 推理产生并复用的中间状态，本轮仅作分类 | 随请求与上下文变化 | 复用范围取决于正确的模型、上下文与运行条件 | 通常作为缓存，不直接等同 Primary Durable State | 可高复用且对推理延迟敏感 | 相关输入、模型与计算条件仍在时可能重算；上下文缺失时不能无条件保证 |

Checkpoint 是保存某个训练边界的恢复材料集合；Optimizer / Training State 是运行中的状态类别，两者存在包含关系，并非六种彼此完全不重叠的文件格式。Model Weight 是模型参数状态；只保留部署 weights，未必保留完整续训所需材料。KV Cache 则是推理过程中形成的中间状态，与训练 Dataset、已发布 Weight 和训练恢复点有不同生命周期。

## 2. Training Dataset：复用的是版本内数据，不一定是全部 Dataset

多个 Epoch 重读让 [Cache / Prefetch / Working Set](../09-data-path-performance/04-cache-prefetch.md) 更值得评估；但 shuffle、Rank 分工及热点变化会影响实际复用。Dataset 总量很大，不证明某节点 Working Set 同样大，也不证明缓存可以装下所有实际热数据。

Dataset 可以由很多小对象组成，也可以由包含多个 sample 的大 shard 组成。小请求更容易受对象索引、鉴权、RPC 和调度固定成本限制；大范围传输更容易受网络、内存和设备字节预算限制。代价复用 [Object Layout](../03-object-storage/06-object-layout.md)，sample 与对象的具体映射进入 [Training Data Path](02-training-data-path.md)。

**状态示意：**任务绑定 Dataset 版本 D1。训练期间同名位置发布 D2，如果不同 Worker 随意追随“最新名字”，它们可能消费不同集合。应保留能够解释 D1 的索引、格式与内容引用，并让缓存绑定相容身份；这沿用 Object / Version 模型，不由“只读训练”自动解决。

## 3. Weights 与 Checkpoint：集中读和突发写是不同问题

Weight Loading 是启动或切换版本时的数据准备路径；Steady-state Request Path 是模型已经就绪后处理请求的路径。前者慢可以让扩容迟迟不能产生服务容量，后者慢却不一定与权重下载有关。不能用稳态推理延迟证明 Model Load 快，也不能让加载吞吐冒充持续请求能力。

Checkpoint 则把不断变化的训练状态保存成可恢复边界。周期性的 multi-rank write 可以同时消耗 CPU、GPU staging、网络、设备与 Metadata。它可能位于应用主流程并暂停训练；异步写入虽然与 compute 重叠，仍与输入读取竞争共享资源。对应 [Foreground / Background Interference](../09-data-path-performance/06-foreground-background-interference.md)，不能只按“后台任务”三个字推断其优先级。

## 4. Persistence Classification：先决定失去它意味着什么

| 分类 | 判断依据与典型例子 | 存储责任 |
| --- | --- | --- |
| Must Persist | 所选恢复目标要求保留的完整 checkpoint、部署 weights、不可重采的原始 Dataset | 字节、解释它们的 Metadata 与恢复依赖需要达到声明的持久与保留条件 |
| Can Rebuild but Expensive | 有有效源的 Dataset Cache、昂贵预处理后的派生数据、可重算的推理缓存 | 可评估成本与重填时间；原始来源仍需保护，重建容量也需预算 |
| Ephemeral | 丢失后可直接重算且允许其延迟代价的 scratch / 临时结果 | 可在较短生命周期内使用，不得承担唯一已确认持久状态的责任 |

分类针对具体状态和目标，不是按名字永远定级。同样叫“中间数据”的结果，若原始输入已被删除且它是唯一来源，就不能继续按可重建处理。可缓存的 weights 仍需要可靠主来源：**Cacheable ≠ Durability Not Needed**。

Durability 决策应由 **Recovery Cost + Business / Training Semantics** 决定，还要说明覆盖节点、任务或区域等哪类故障。不是“AI 数据都不用持久化”，也不是“所有数据都用三副本”。保护机制与故障域策略复用 [Data Protection](../07-data-protection/README.md)，历史恢复材料与依赖复用 [Backup / Restore](../07-data-protection/07-backup-restore.md)。

KV Cache 可有高复用价值、较大聚合占用、短生命周期和延迟敏感性；本篇只保留它与 Primary Durable State 的分类边界，不展开分配、共享、淘汰或远端机制。

## 5. Storage Metrics 怎样映射到 AI Outcome

Storage Throughput 是路径证据，不是最终目标。需要选择与状态类别对应的 Outcome：

| 存储场景 | 应联系的应用 Outcome | 还需要哪些路径证据 |
| --- | --- | --- |
| Dataset 供给 | GPU idle / stall due to input、step time、effective samples / tokens per second | DataLoader wait、CPU decode、Cache Hit、网络和 H2D |
| Weight Loading | model load time、Worker ready time、扩容到有效容量的时间 | 并发消费者、源端读取、节点缓存、反序列化与 GPU 加载 |
| Checkpoint Save | checkpoint pause、完成滞后、最近有效恢复点的进度 | staging、并行写、验证与 Metadata 发布完成 |
| Restore | 恢复到可继续训练的时间与进度损失 | shards 读取、校验、重分片和 runtime state 重建 |
| Inference 中间状态 | inference latency、有效 tokens/s 等相应目标 | 本轮只标明测量方向，缓存路径留待后续 |

**Storage Throughput ↑ ≠ GPU Utilization 一定 ↑。** GPU 已受 Compute 限制时，增加存储带宽可能只增加空闲供给能力。GPU utilization 高也不能单独证明训练有效进度高；应在相同模型、batch、数据质量与资源条件下看实际完成量和等待原因。

应用样本、压缩对象字节、解码后 tensor 字节与 H2D 字节不是同一分母。预取浪费和重试可以提高观测流量，却不增加有效 samples/s。按 [Benchmark / Bottleneck Analysis](../09-data-path-performance/03-benchmark-bottleneck-analysis.md) 固定条件、对齐窗口并检验候选瓶颈，才能解释收益以及 Bottleneck Shift。

## 适用边界与阅读衔接

本文表格、分类与状态例子是通用工程模型，不包含框架接口契约、固定规模或产品内部实现。后两篇分别回答数据如何供给 GPU，以及持久 Model / Training State 如何加载和恢复；GPU Direct Path 与 KV Cache 机制仅在章节入口规划。

[下一篇：Training Data Path](02-training-data-path.md) · [Model Weights / Checkpoints](03-model-weights-checkpoints.md) · [返回章节入口](README.md)
