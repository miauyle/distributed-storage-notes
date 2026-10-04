# Foreground / Background Interference：共享资源中的性能边界

前台 GET 没有等待 Repair 任务的返回，为什么 Repair 开始后 GET 的 P99 仍会上升？因为**不在请求关键路径，不等于不消耗请求所依赖的资源**。后台工作可以通过共享队列、设备与执行资格影响前台。

本篇连接 [端到端成本模型](01-end-to-end-cost-model.md)、[Batching / Backpressure](05-batching-backpressure.md) 和既有 Recovery / Operations。目标是解释资源竞争与控制边界，不重新设计任务调度器，也不展开未来的 Scrubbing 或完整 Observability 专题。

## 1. Foreground 与 Background 是职责区别，不是资源隔离证明

Foreground Requests 是面向当前服务请求的工作；Background 包括 [Repair / Rebuild](../10-recovery-operations-observability/02-repair-rebuild.md)、[Rebalance](../10-recovery-operations-observability/04-rebalance.md)、[Migration](../10-recovery-operations-observability/05-data-migration.md)、[Evacuation](../10-recovery-operations-observability/06-node-evacuation.md) 等。它们的触发与完成条件不同，资源成本却可能重叠。

| 共享资源 | 后台可能产生的工作 | 对前台的影响路径 |
| --- | --- | --- |
| Disk / Device I/O | Source Read、Target Write、持久化与验证读取 | 队列等待、服务次序变化、可用 IOPS / Throughput 减少 |
| Network | 副本复制、分片重建输入、迁移与追平流量 | 共享链路排队、拥塞，前台正文或控制 RPC 延迟增加 |
| CPU | Checksum、Encode / Decode、协议及任务处理 | 可用执行时间下降，前台处理或调度等待增加 |
| Memory | Copy Buffer、在途状态、缓存填充 | Buffer 紧张、缓存被挤占，Miss 又增加下层工作 |
| Metadata / Control Path | 布局更新、资格检查、Ownership 与任务状态提交 | 共享分区或执行队列竞争；字节少也可能有高固定成本 |
| Queue / Concurrency | Worker、连接池、RPC 或设备在途资格 | 后台先占用资格，前台即使有资源需求也不能及时开始 |

一个后台 Copy 可能同时在 Source 占读取能力、在链路占字节预算、在 Target 占写入与持久化能力。只在 Target 限速，不必然限制 Source 压力。多 Worker 各自遵守局部限制，合起来也可能超过同一热点资源的预算。

[第一篇](01-end-to-end-cost-model.md) 区分了 Critical Path 与 Total Resource Consumption：后台未出现在这次 GET 的依赖链，却改变了 GET 在各阶段面对的队列和服务能力。**P99、Timeout 与 Throughput 变化不要求存在一次直接等待后台任务的调用。**实际因果仍需测量，不能看到后台启动与延迟上升同时发生，就断定所有延迟都来自 Copy。

## 2. Noisy Neighbor 不仅发生在“同一台机器”

Noisy Neighbor 指共享资源的一方产生需求，损害另一方可获得的服务。它可以发生在同节点、同设备、同交换链路、同 Metadata Partition，也可以是多个租户或同一租户的不同工作负载；这里不要求某种云产品的租户隔离模型。

**工程示意：**前台以小对象读取为主，后台以大范围顺序复制为主。后台 MB/s 很高，可能挤占链路；如果后台改成大量小单元，即使 MB/s 下降，IOPS、RPC、Metadata 更新或 CPU 仍可能增长。因此“后台带宽变低”不能单独证明前台得到更多有效能力。

缓存也是共享资源。迁移或验证读取若无条件进入同一 Read Cache，可能挤走前台热点，使额外 Miss 继续放大设备竞争。应回看 [Cache Admission / Prefetch](04-cache-prefetch.md)，先判断数据是否有复用价值，再谈缓存或预取的预算，而不是把所有后台读取视为前台加速。

## 3. Priority / QoS / Throttling 需要对应实际资源

QoS 在这里指对不同工作获得的服务进行约束或分配的通用思想，不承诺某个产品提供硬隔离。常用控制可以组合，但含义不同：

| 控制 | 主要约束 | 不能替代什么 |
| --- | --- | --- |
| Priority | 在可选择工作之间决定先后或权重 | 不增加物理容量，也未必能抢占已发出的长 I/O |
| Bandwidth Limit | 某边界的 bytes/s | 不直接限制 IOPS、CPU、RPC 数或 Metadata 压力 |
| IOPS Limit | 某 I/O 边界的操作速率 | 不直接限制大操作的字节与执行时间 |
| Concurrency Limit | 同时执行或在途工作数 | 不保证每项工作大小与成本相同，也不限制无界待执行队列 |
| Reservation | 为某类工作保留可服务预算或资格 | 配置承诺需要底层容量支撑，局部保留不等于全路径保障 |
| Admission Control | 不接收超过当前预算的新增工作 | 不会自动终止已投入执行的工作，也不能替代结果正确性 |

仅限制 MB/s 的 Copy，仍可能由大量小请求耗尽 RPC 资格；限制 Worker 数，单个 Worker 仍可能 Fan-out 到很多来源。CPU 密集的 EC Reconstruction 又未必先撞到网络上限。应按 Source、Target 和共享控制路径识别成本，必要时组合不同口径，而不把一种限流参数当作全系统预算。

Priority 的边界同样重要：若设备上已经排入大量后台工作，上层刚提高前台优先级不保证立即生效。需要考虑控制生效的位置和已有在途工作。前台永远严格优先也可能让后台饥饿，留下保护缺口或无法完成计划退出；反过来，后台保留过大预算又会牺牲前台。没有无成本的排序规则。

## 4. Recovery Speed 与 Foreground Performance 是动态取舍

Repair 恢复的是 Protection Gap，其价值不能只用后台吞吐衡量。激进恢复可能更快补齐保护，也可能让前台排队、Timeout 与 Retry 增加，进一步消耗预算；过度保守可能让前台平稳，却延长 Degraded Window，提高再次故障时的风险。

| 当前情况 | 可以考虑的方向 | 仍需确认的边界 |
| --- | --- | --- |
| 保护缺口严重、再次故障容忍度低 | 给恢复更多预算，必要时约束其他工作 | Source 有效、Target 合格、资源确实能转化为保护恢复，而非重复尝试 |
| 前台延迟与队列快速恶化 | 降低可延后的后台并发或速率，控制新工作 | 不将全部恢复无限期暂停；重新评估风险和剩余保护来源 |
| 普通布局均衡、无紧急保护缺口 | 使用空闲预算或较低优先级推进 | 低优先级仍需有收敛能力，不能长期饥饿 |

这不是“Repair 永远压过一切”的固定规则。普通 Rebalance 通常可以比紧急 Repair 更可延后，但实际策略还依赖保护风险、用户服务目标、资源共享关系和任务期限。已确定的安全完成条件不能为了追求速度被省略。

后台 bytes/s 也不等于 Protection Restored / s。复制很快，但 Generation 已过期、Placement 不合格或 Layout 尚未提交，仍未恢复保护。验证与完成条件复用 [Repair / Rebuild](../10-recovery-operations-observability/02-repair-rebuild.md)；大量任务的身份、Checkpoint、Lease 与 Fencing 复用 [Recovery Task Coordination](../10-recovery-operations-observability/03-recovery-task-coordination.md)。性能控制不替代这些正确性条件。

## 5. Adaptive Control：随服务压力与保护风险调整，而非追一个仪表

通用思路是周期性观察前台 Latency / Error、资源利用与 Queue、Recovery Backlog，以及尚未满足的 Protection Risk，再调整后台速率或并发。前台压力持续上升时减少可延后工作；出现余量且恢复落后时逐步增加。这里只说明反馈方向，不设计完整自动控制算法。

需要避免三个误判：

- **只看 Utilization。** 总体 CPU 不高，热点 Metadata Partition 或共享链路仍可能受限；利用率本身不是瓶颈证明。
- **只看 P99。** 样本、窗口和工作负载变化都会影响它；若积压正在增长，较迟到达的请求还未完成，单个完成窗口可能低估压力。
- **只看 Backlog 数量。** 不同任务大小与保护风险不同，许多低风险小任务不必比少数失去容错余量的任务更紧急。

反馈有延迟，已发出的工作也不能立即收回。调整宜考虑观察窗口、保守步幅及稳定区间，避免一次 P99 波动就大幅增减，反复震荡。Admission、Rate 和 Concurrency 应共同约束实际受限边界；Prefetch 等推测性工作也需要计入共享预算，而不是当作免费资源。

## 6. 如何验证“后台可推进，前台不被拖垮”

按 [Benchmark](03-benchmark-bottleneck-analysis.md) 保持前台 Workload、Dataset、Cache 状态和测量边界一致，再改变一种主要后台条件：

| 实验 | 主要回答什么 |
| --- | --- |
| 无后台的基线 | 前台本身的吞吐、延迟与限制在哪里？ |
| 固定后台工作，改变其速率或并发 | 前台损失与后台推进速度怎样随预算变化？ |
| 相似后台字节速率，改变单元大小 | 是否由 IOPS、RPC 或 Metadata 等非字节资源支配？ |
| 保持前台总需求，改变资源重叠位置 | 竞争是否集中在某个 Source、Target 或共享链路？ |

每次同时记录前台有效吞吐、P95 / P99、错误与 Retry，以及后台读取、写入、在途工作和已验证提交的推进量。也应关注生成器自身是否受限；客户端发不出原计划流量时，前台结果可能只是变轻的负载。

测试窗口需覆盖稳态，不能只测任务刚启动或缓存尚未变化的短暂阶段。要解释某项控制为何有效，应结合队列与资源证据做受控比较，而不是以后台 MB/s 降低或前台 Average 改善作唯一结论。

## 适用边界与参考

以上是通用共享资源模型、工程取舍与实验方法，不代表固定 Scheduler、产品 QoS 承诺或优先级规则。参考核对日期：**2026-10-02**。

[Argon: Performance Insulation for Shared Storage Servers，FAST 2007](https://www.usenix.org/conference/fast-07/argon-performance-insulation-shared-storage-servers) 研究共享存储中的 Disk / Cache 干扰与性能隔离问题；这里只引用问题背景，不将其具体机制或实验结果写成现代分布式存储的标准实现。

本阶段形成 **Cache / Prefetch → Batching / Backpressure → Shared-resource Interference**：减少慢层访问、限制粒度与积压、分配共享预算。低层数据移动与高性能网络仍是后续规划，不在这里展开。

[Recovery / Operations](../10-recovery-operations-observability/README.md)
