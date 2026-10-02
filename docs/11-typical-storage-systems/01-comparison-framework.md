# Storage System Comparison Framework：比较架构决策，而不是功能清单

## 页面定位与阅读前提

前面各章建立了通用模型。本章转而检查真实系统怎样组合这些模型：同样暴露 S3、同样支持 EC，是否意味着 Metadata、放置、确认和恢复路径相同？答案需要证据，不能从功能名称推导。

本篇提供统一观察坐标，不给产品结论或排名。接下来按同一顺序阅读 [Ceph RGW](02-ceph-rgw.md) 和 [MinIO](03-minio.md)。它们是第一组案例，不是完整对象存储横评。

## 1. 比较单位：接口、状态与部署条件

先写清比较的是哪个接口、产品版本、文档分支与部署范围。例如“单站点某接口的单 Key 写入”与“跨站点复制完成”不是同一契约；一套集群可以提供多个接口，而接口看到的对象粒度未必等于底层存储单元。

比较记录至少包含：访问接口、保护策略、拓扑与故障域、功能开关、来源和核对日期。没有这些条件，“强一致”“容忍故障”“扩容自动平衡”都容易变成过度概括。

## 2. 三层证据：事实、映射、工程分析

| 层次 | 应写什么 | 不应跨越的边界 |
| --- | --- | --- |
| Product Fact · 产品事实 | 官方明确描述的组件职责、行为、条件；附版本与来源 | 搜索摘要、旧博客和宣传数字不能代替当前契约 |
| Mapping to Generic Model · 通用映射 | 该事实对应本仓库哪个机制；是否只近似对应 | 产品术语不能强行一一翻译为通用术语 |
| Engineering Implication · 工程分析 | 在给定路径与工作负载下可能产生的成本和风险 | 推导不是官方性能、ACK 或可用性承诺 |

**示意分析：** 文档若说明正文由入口代理转发，可记录“入口参与 Data Path”的产品事实；映射到网关职责；再分析入口 CPU、网络和并发可能限制吞吐。第三步仍需要实验验证，不能直接得出“入口一定是瓶颈”。方法见 [Benchmark / Bottleneck Analysis](../09-data-path-performance/03-benchmark-bottleneck-analysis.md)。

资料未覆盖精确确认边界时，应写“公开资料不足以得出更精确结论”，同时说明缺的是哪一层：本地设备持久化、对象 Metadata 提交，还是远端保护完成。未知不是架构缺陷，也不是猜测的许可。

## 3. 十三个统一维度

### Access Model：客户端操作的是什么？

记录 Object / Block / File 接口与底层存储层的关系。两个系统提供 S3 API，只说明客户端协议有可比较部分；并不证明内部 Namespace、存储单元或提交实现相同。回看 [Object Model](../03-object-storage/01-object-model.md)。

### Client / Gateway / Frontend：入口承担什么职责？

请求首先到哪里？入口代理正文、只处理 Control Path，还是允许客户端直接定位数据节点？负载均衡器与存储网关也要分开。图中一个逻辑职责不必对应一个独立进程。

### Metadata Architecture：系统怎样记录对象状态？

分别找 Namespace、Object Metadata、当前版本、布局引用与协调状态。问它们与数据共置还是由独立服务管理，以及 GET、PUT、LIST 依赖哪些记录。**Metadata 存在与存在独立 Metadata Service 是两回事。** 见 [Metadata / Object Index](../08-consistency-metadata-partitioning/02-metadata-object-index.md)。

### Partitioning / Placement：逻辑状态怎样落到资源？

列出 Namespace → Shard / Placement Unit → Device / Node 的真实关系，再分别指出逻辑划分、物理放置和请求路由由谁执行。名字相似的分组不必具有相同生命周期或恢复边界。坐标见 [Partition / Ownership / Routing](../08-consistency-metadata-partitioning/03-partition-ownership-routing.md) 与 [Failure Domain & Placement](../07-data-protection/03-failure-domain-placement.md)。

### Data Protection：保护粒度与故障假设是什么？

不能止于“支持 Replication / EC”。要问保护的是 API Object、内部 Unit 还是某个编码组；副本或 Fragment 怎样跨故障域分布；缺失、无效、Degraded 的状态怎样表达。机制回链 [Replication](../07-data-protection/01-replication.md)、[Erasure Coding](../07-data-protection/02-erasure-coding.md)。

### Read Path：怎样找回所选状态的字节？

以 Routing / Metadata → Data Location → Read / Verify → Response 作为问题清单，映射真实组件；不要要求每个系统都顺序执行这些独立 RPC。观察入口代理、Metadata Lookup、Fan-out、Replica / Fragment 选择、缓存及校验范围。见 [Read / Write Path](../03-object-storage/03-read-write-path.md)。

### Write Path：什么时候有资格返回成功？

区分放置、编码或复制、持久保护、对象状态发布与 ACK。逐层记录官方支持的结论，避免用底层写完成代替 API Commit。失败时已写字节、未发布状态和客户端 Unknown Result 可能并存；不要再重复通用提交教程。

### Consistency：谁能观察到什么状态？

分别核对单 Key、LIST / Namespace、Metadata、远端复制。注明接口、版本、操作与条件；单对象保证不能扩展成多对象事务，内部后台状态也不自动拥有相同保证。见 [Observable State](../08-consistency-metadata-partitioning/01-consistency-observable-state.md)。

### Failure Recovery：谁发现缺口，谁补回保护？

记录故障信号、Degraded 状态、有效来源选择、Repair / Healing、任务接管及完成条件。产品的 Heal 可能涵盖读取时修复、返回节点补齐或后台重建，不能只凭名称认定完全等价。参照 [Repair / Rebuild](../10-recovery-operations-observability/02-repair-rebuild.md)。

### Rebalance / Expansion：拓扑变化后旧数据怎样变化？

新增资源后谁更新布局？已有数据会不会移动？移动是否自动，控制与完成状态是什么？Map、Ring、Hash 的变化与字节搬迁不是同一步。区分容量扩张、数据平衡、请求负载平衡，参照 [Rebalance](../10-recovery-operations-observability/04-rebalance.md)。

### Integrity：检测覆盖哪一层？

记录 Checksum / Bitrot Detection、Scrub / Audit 与修复。检查摘要绑定的 Unit、Generation、范围；“校验通过”不代表一定是当前对象，“能检测”不代表一定能定位或恢复。见 [Checksum / Data Integrity](../07-data-protection/04-checksum-data-integrity.md)。

### Data Path / Performance：架构可能在哪里付出成本？

只分析代理 Hop、网络 Fan-out、EC CPU、Metadata Lookup、Memory Copy 与后台干扰。Critical Path 与总资源消耗分开；不引用缺少 Workload、保护策略、并发与测量边界的峰值数字。参照 [End-to-End Cost Model](../09-data-path-performance/01-end-to-end-cost-model.md)。

### Operations / Observability：怎样证明当前状态？

观察健康状态、容量、恢复进度、Metrics、Logs 和任务状态的公开入口。API 可读不代表保护已恢复，单个健康聚合也不覆盖所有依赖。参照 [Observability Signals](../10-recovery-operations-observability/09-observability-signals.md)。不把案例写成运维命令大全。

## 4. 怎样使用这套框架

每个案例采用相同的十四个主标题：先定位系统，再按以上十三维度中的访问到性能展开，最后给通用模型映射表。System Position 包含入口职责，避免额外生成第二套产品目录。

阅读时保留一个问题：**如果这个架构决策改变，哪条数据路径、状态边界或故障假设会改变？** 例如 Metadata 共置可能减少独立服务边界，但不消除 Metadata I/O；分组可计算定位也不意味着无需拓扑信息或状态协调。这些是通用分析问题，不是对某个产品的结论。

| 结论类型 | 可接受的比较结果 |
| --- | --- |
| 相同 API，不同内部对象粒度 | 比较映射与提交边界，不判谁“更原生” |
| 保护组承担部分相似职责 | 标注 roughly maps to，记录分组与重映射差异 |
| 不同层数与后台机制 | 分析可能的资源成本，再在相同 Workload 下验证 |
| 官方资料没有精确保证 | 留出证据缺口，不给分数或总体 Winner |

下一篇：[Ceph RGW](02-ceph-rgw.md)。[返回专题入口](README.md)。
