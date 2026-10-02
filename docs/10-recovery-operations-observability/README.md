# Failure Recovery / Operations / Observability

## 页面定位

从故障信号到保护恢复，串联触发判断、数据修复、任务协调与结果验证。第一阶段建立最小 Failure Recovery 闭环；更广泛的运维与观测方法仍属于后续规划。

## 核心问题

- 如何区分短暂不可达、永久故障与数据损坏？
- 如何确定受影响数据，安全安排恢复任务并验证结果？
- Repair 如何检查 Generation、Ownership、Placement 与提交结果？
- 如何兼顾恢复窗口和前台 I/O，避免 Recovery Storm？

## 已完成：Failure Recovery 第一阶段

推荐顺序：**Failure Detection / State Transition → Repair / Rebuild → Recovery Task Coordination**。

| 顺序 | 正文 | 回答的问题 |
| --- | --- | --- |
| 1 | [Failure Detection / State Transition](01-failure-detection-state-transition.md) | 什么时候开始恢复？从故障信号判断保护缺口、Grace Period、节点返回资格与恢复触发 |
| 2 | [Repair / Rebuild](02-repair-rebuild.md) | 数据如何补回来？区分临时读取与持久修复，验证来源、目标、状态与布局提交 |
| 3 | [Recovery Task Coordination](03-recovery-task-coordination.md) | 大量修复怎样可靠执行？建立稳定任务身份、重试、Fencing、Checkpoint、限流和完成判定 |

三篇共同形成 **Detect → Repair → Coordinate → Verify** 的闭环：识别需要恢复的保护状态，执行受控补齐，并根据有效布局判定结果，而不是依据机器 alive 或任务进度宣告 Healthy。

前置知识复用 [Distributed Systems Foundations](../06-distributed-systems/README.md) 的 Timeout / Lease / Fencing / Retry、[Data Protection](../07-data-protection/README.md) 的 Replication / EC / Failure Domain，以及 [Metadata / Partitioning](../08-consistency-metadata-partitioning/README.md) 的 Generation / Layout / Ownership；本章不重复这些基础正文。

## 后续规划

- Rebalance。
- Data Migration。
- Node Evacuation。
- Capacity Management。
- Integrity / Silent Corruption / Scrubbing。
- Recovery Observability。
- Metrics / Logs / Tracing。
- SLI / SLO。
- Failure Drill / Troubleshooting。

以上仍为规划，不表示已有正文。本轮止于第一阶段三篇，不因 Repair 与搬迁共有复制动作就扩展 Migration / Rebalance，也不提前建设完整 Observability 专题。

[数据保护机制](../07-data-protection/README.md) · [返回 Knowledge Map](../../README.md)
