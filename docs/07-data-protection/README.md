# Replication / Erasure Coding / Data Protection

## 页面定位

讨论冗余布局、数据安全目标与保护成本，回答“数据如何被保护、能够承受什么故障”；故障后的执行过程由恢复专题展开。这里集中维护 Object / Block / File 共用的数据保护机制，不把某种产品实现当作标准架构。

## 已完成正文与阅读顺序

按 **Replication → Erasure Coding → Failure Domain & Placement** 阅读。三篇正文已完成：先理解完整副本及确认条件，再理解编码组的容量与恢复预算，最后把预算对应到实际故障域和放置约束。

| 顺序 | 文章 | 阅读后应理解的问题 |
| --- | --- | --- |
| 1 | [Replication：副本数量与写入承诺](01-replication.md) | N / W、同步与异步、ACK、Quorum 的假设、写入故障与 Degraded 状态 |
| 2 | [Erasure Coding：减少冗余字节，把成本放在哪里？](02-erasure-coding.md) | k+m、Stripe、Fragment、确认时保护预算、正常 / 降级读与工程成本 |
| 3 | [Failure Domain & Placement：冗余必须放在正确的地方](03-failure-domain-placement.md) | 相关故障、域内集中度、放置取舍，以及 Policy / Algorithm / Routing 的区别 |

对象存储读者可从[Object Layout](../03-object-storage/06-object-layout.md)接入：**Object → Internal Storage Units → Replication / EC → Placement across Failure Domains**。Multipart Part 是上传会话资源；Replica 与 EC Fragment 是内部数据保护表示，不改变用户的 Object / Version 身份。本文链条只建立这些关系，不重复对象布局正文。

三篇采用通用模型、限定假设和工程推导；公开论文用于核对概念或提供案例，未描述 AWS S3 或其他产品的内部写入协议。

## 核心问题

- 可用性与持久性有什么区别，冗余能覆盖哪些故障？
- 副本与纠删码如何权衡容量、读写成本和修复成本？
- 写入确认时机与同步 / 异步复制如何影响故障后的状态？
- 节点、机架与区域故障域如何约束数据布局？

## 后续规划（尚未撰写）

- Repair / Rebuild：从保护缺口到补齐与验证；现有 EC 正文仅解释重构字节的基本机制和成本，不含恢复任务流程。
- Cross-region protection：跨区域的保护目标、传播边界与依赖。
- Backup / Disaster Recovery：备份、历史保留与灾备能力的边界。
- RPO / RTO：数据损失窗口与恢复时间目标及其衡量。
- Integrity / Silent Corruption：完整性、静默损坏检测与保护边界。

故障后的调度与持续运行由[恢复与运维专题（目前为骨架）](../10-recovery-operations-observability/README.md)承接；一致性、索引与分区机制由[08 专题（目前为骨架）](../08-consistency-metadata-partitioning/README.md)承接。本轮不展开这些规划或其他一级章节正文。

[故障恢复与运维](../10-recovery-operations-observability/README.md) · [返回 Knowledge Map](../../README.md)
