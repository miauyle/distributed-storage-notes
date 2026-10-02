# Replication / Erasure Coding / Data Protection

## 页面定位

讨论冗余布局、数据安全目标与保护成本，以及如何判断数据是否符合预期状态。第一阶段回答“如何保留恢复材料、能够承受什么故障”，第二阶段建立 Integrity 判断与错误来源识别，第三阶段连接跨地理故障域的当前保护与历史恢复点；主动扫描、修复与灾备执行由恢复专题展开。这里集中维护 Object / Block / File 共用机制，不把某种产品实现当作标准架构。

## 已完成第一阶段：Redundancy / Placement

按 **Replication → Erasure Coding → Failure Domain & Placement** 阅读。三篇正文已完成：先理解完整副本及确认条件，再理解编码组的容量与恢复预算，最后把预算对应到实际故障域和放置约束。

| 顺序 | 文章 | 阅读后应理解的问题 |
| --- | --- | --- |
| 1 | [Replication：副本数量与写入承诺](01-replication.md) | N / W、同步与异步、ACK、Quorum 的假设、写入故障与 Degraded 状态 |
| 2 | [Erasure Coding：减少冗余字节，把成本放在哪里？](02-erasure-coding.md) | k+m、Stripe、Fragment、确认时保护预算、正常 / 降级读与工程成本 |
| 3 | [Failure Domain & Placement：冗余必须放在正确的地方](03-failure-domain-placement.md) | 相关故障、域内集中度、放置取舍，以及 Policy / Algorithm / Routing 的区别 |

对象存储读者可从[Object Layout](../03-object-storage/06-object-layout.md)接入：**Object → Internal Storage Units → Replication / EC → Placement across Failure Domains**。Multipart Part 是上传会话资源；Replica 与 EC Fragment 是内部数据保护表示，不改变用户的 Object / Version 身份。本文链条只建立这些关系，不重复对象布局正文。

三篇采用通用模型、限定假设和工程推导；公开论文用于核对概念或提供案例，未描述 AWS S3 或其他产品的内部写入协议。

## 已完成第二阶段：Data Integrity

推荐顺序：**Checksum / Data Integrity → Silent Corruption Detection**。

| 顺序 | 文章 | 阅读后应理解的问题 |
| --- | --- | --- |
| 4 | [Checksum / Data Integrity](04-checksum-data-integrity.md) | Durability 与 Integrity、校验 Scope、受保护的校验记录、Detect 与 Correct，以及验证不等于新鲜度 |
| 5 | [Silent Corruption Detection](05-silent-corruption-detection.md) | Read Success 与正确内容的区别，错误信号、可信来源、多数副本边界与潜伏损坏 |

两阶段形成 **Redundancy / Placement → Integrity Detection**：有恢复材料，还要知道哪些材料属于正确的所需状态。继续阅读 10 的 [Scrubbing / Integrity Repair](../10-recovery-operations-observability/07-scrubbing-integrity-repair.md)，理解主动覆盖 Cold Data、保留未验证范围并安全修复；本章不重复扫描与任务调度。

## 已完成第三阶段：Geographic / Historical Protection

推荐顺序：**Cross-region Protection → Backup / Restore**。

| 顺序 | 文章 | 阅读后应理解的问题 |
| --- | --- | --- |
| 6 | [Cross-region Protection](06-cross-region-protection.md) | 本地提交与远端保护、WAN 确认成本、传播顺序、保护 Lag 与依赖独立性 |
| 7 | [Backup / Restore](07-backup-restore.md) | 历史恢复点、版本与快照边界、Catalog / Key 依赖、保留及实际恢复验证 |

Cross-region Protection 保护更大 Failure Domain 下的当前状态，Backup 提供历史 Recovery Point；二者互补，不能相互替代。材料准备之后，按 **Cross-region Protection → Backup / Restore → [Disaster Recovery / RPO / RTO](../10-recovery-operations-observability/11-disaster-recovery-rpo-rto.md)** 进入业务恢复。本章不重复 Authority 切换、Failover / Failback 的执行过程。

## 核心问题

- 可用性与持久性有什么区别，冗余能覆盖哪些故障？
- 副本与纠删码如何权衡容量、读写成本和修复成本？
- 写入确认时机与同步 / 异步复制如何影响故障后的状态？
- 节点、机架与区域故障域如何约束数据布局？
- 怎样判定字节及状态关联正确，为什么校验通过、冗余数量与当前状态不能互相替代？
- 整个 Region 不可用或当前状态本身错误时，独立恢复来源与历史恢复点在哪里？

## 后续扩展边界

原有 Cross-region Protection、Backup / Disaster Recovery 与 RPO / RTO 规划已由第三阶段及 10 的灾备正文承接，不再列为尚未撰写。后续按明确任务扩展，本轮止于当前状态保护、历史材料与恢复能力，不预建空文章。

故障后的执行与调度已由 [Repair / Rebuild](../10-recovery-operations-observability/02-repair-rebuild.md)及 [Recovery Task Coordination](../10-recovery-operations-observability/03-recovery-task-coordination.md)承接，[恢复与运维专题](../10-recovery-operations-observability/README.md)还包含主动数据移动、完整性运维、运行健康与灾备正文；一致性、索引与分区机制的第一阶段见 [08 专题](../08-consistency-metadata-partitioning/README.md)。

[故障恢复与运维](../10-recovery-operations-observability/README.md) · [返回 Knowledge Map](../../README.md)
