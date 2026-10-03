# Distributed Systems

## 页面定位

整理存储系统依赖的最小分布式基础，重点解释故障观察、修改资格与重复执行的边界，供后续 Consistency、Metadata、Partitioning、Recovery 复用；不写成完整分布式系统教材，应用可见的一致性另见专题。

## 已完成正文与阅读顺序

按 **Failure / Timeout → Coordination / Ownership → Retry / Idempotency** 阅读。三篇正文已完成，分别回答：我怎么知道远端发生了什么？谁现在有资格修改状态？不确定时重新执行会发生什么？

| 顺序 | 文章 | 阅读后应理解的问题 |
| --- | --- | --- |
| 1 | [Failure Model / Timeout：远端发生了什么？](01-failure-model-timeout.md) | Partial Failure、超时、未知结果、不可达与永久丢失，以及故障检测取舍 |
| 2 | [Quorum / Leader / Lease / Fencing：谁现在有资格修改状态？](02-quorum-leader-lease-fencing.md) | Quorum 与 Consensus 的边界、资格期限、Split Brain，以及资源侧拒绝旧 Token |
| 3 | [Retry / Idempotency / Deduplication：不确定时重新执行会怎样？](03-retry-idempotency-deduplication.md) | 重试、效果幂等、操作身份、去重记录与一次效果的适用边界 |

前置连接：[Replication](../07-data-protection/01-replication.md)已有 Quorum 集合与 Write ACK 基础；[S3 Core Semantics](../03-object-storage/02-s3-core-semantics.md)已有 Timeout / Retry 的接口例子；[Read / Write Path](../03-object-storage/03-read-write-path.md)已有提交结果未知的路径分析。三篇提取公共机制，不重复这些正文。

本文链条采用通用模型与工程推导，公开资料用于核对设计边界，不将产品实现或某种 Token / Dedup 接口当作统一标准。

## 核心问题

- 超时能否证明节点或操作已经失败？
- 网络分区、节点崩溃与时钟偏差如何影响决策？
- 共识、Quorum、Leader 与 Lease 分别解决什么问题？
- 重试、重复请求与成员变更如何避免破坏系统状态？

## 按需扩展规划（尚未撰写）

- Consensus Protocol 基础：按实际需要学习协议保证、失败条件与边界，当前只完成概念区分。
- Membership Change：参与集合变化时的资格与状态衔接。
- Distributed Task Coordination：分布式任务的领取、执行与结果协调；现有正文仅使用任务创建例子。
- Clock / Ordering：时间假设、事件顺序与状态代际；现有 Lease 正文只说明必要约束。
- CAP 的适用边界：仅按具体缺口扩展，不因其属于经典主题而自动补正文。

后续应用机制见[一致性 / 元数据 / 分区](../08-consistency-metadata-partitioning/README.md)，故障后的执行流程见[恢复与运维](../10-recovery-operations-observability/README.md)，两者均已有正文。本章止于上述三篇公共基础，其他专题继续保留规划。

[一致性 / 元数据 / 分区](../08-consistency-metadata-partitioning/README.md) · [返回 Knowledge Map](../../README.md)
