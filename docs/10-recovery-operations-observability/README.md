# Failure Recovery / Operations / Observability

## 页面定位

从故障信号到保护恢复，再进入主动数据移动与布局维护。第一阶段建立最小 Failure Recovery 闭环，第二阶段建立 Rebalance、Online Data Migration 与 Node Evacuation 的目标、切换和退出边界，第三阶段承接 Data Integrity 机制，建立主动验证与安全完整性修复；更广泛的运维与观测方法仍属于后续规划。

## 核心问题

- 如何区分短暂不可达、永久故障与数据损坏？
- 如何确定受影响数据，安全安排恢复任务并验证结果？
- Repair 如何检查 Generation、Ownership、Placement 与提交结果？
- 如何兼顾恢复窗口和前台 I/O，避免 Recovery Storm？
- 如何区分平衡、迁移与撤离的目标，安全处理并发更新和旧资格？
- 如何确认新布局可用，以及节点不再承担必须保留的责任？
- 长期不读取的数据如何获得验证，怎样区分扫描覆盖、修复完成与当前健康状态？

## 已完成第一阶段：Failure Recovery Core

推荐顺序：**Failure Detection / State Transition → Repair / Rebuild → Recovery Task Coordination**。

| 顺序 | 正文 | 回答的问题 |
| --- | --- | --- |
| 1 | [Failure Detection / State Transition](01-failure-detection-state-transition.md) | 什么时候开始恢复？从故障信号判断保护缺口、Grace Period、节点返回资格与恢复触发 |
| 2 | [Repair / Rebuild](02-repair-rebuild.md) | 数据如何补回来？区分临时读取与持久修复，验证来源、目标、状态与布局提交 |
| 3 | [Recovery Task Coordination](03-recovery-task-coordination.md) | 大量修复怎样可靠执行？建立稳定任务身份、重试、Fencing、Checkpoint、限流和完成判定 |

三篇共同形成 **Detect → Repair → Coordinate → Verify** 的闭环：识别需要恢复的保护状态，执行受控补齐，并根据有效布局判定结果，而不是依据机器 alive 或任务进度宣告 Healthy。

前置知识复用 [Distributed Systems Foundations](../06-distributed-systems/README.md) 的 Timeout / Lease / Fencing / Retry、[Data Protection](../07-data-protection/README.md) 的 Replication / EC / Failure Domain，以及 [Metadata / Partitioning](../08-consistency-metadata-partitioning/README.md) 的 Generation / Layout / Ownership；本章不重复这些基础正文。

## 已完成第二阶段：Planned Data Movement / Operations

推荐顺序：**Rebalance → Online Data Migration → Node Evacuation**。

| 顺序 | 正文 | 回答的问题 |
| --- | --- | --- |
| 4 | [Rebalance](04-rebalance.md) | 为什么需要主动移动？区分容量、数据和负载目标，选择候选并受控收敛 |
| 5 | [Online Data Migration](05-data-migration.md) | 如何在并发变化中安全切换？建立 Base Copy、Catch-up、Cutover、Fencing 与回退边界 |
| 6 | [Node Evacuation](06-node-evacuation.md) | 节点什么时候能退出？停止新分配，转移责任并验证保护、引用、归属与在途操作 |

前两阶段形成 **Reactive Recovery → Planned Data Movement**：前者补齐保护缺口，后者在数据仍有效时改善分布、改变位置或计划退出节点。共享复制、验证、任务协调和限流能力，但分别判断 Trigger、Priority、Completion Criteria 与失败处理；Source 在移动中失效时，可以重新进入第一阶段的 Repair 链。

## 已完成第三阶段：Integrity Operations

机制前置按 **[Checksum / Data Integrity](../07-data-protection/04-checksum-data-integrity.md) → [Silent Corruption Detection](../07-data-protection/05-silent-corruption-detection.md)** 阅读，再进入本章正文。

| 顺序 | 正文 | 回答的问题 |
| --- | --- | --- |
| 7 | [Scrubbing / Integrity Repair](07-scrubbing-integrity-repair.md) | Cold Data 如何主动验证？明确 Coverage、Skipped / Unknown、可信修复输入、完成边界与前后台资源取舍 |

Data Integrity 的机制基础在 07，本章只承接 **主动验证 → 发现 → Integrity Repair**，复用第一阶段的 Repair / Task Coordination。扫描结束不等于所有数据健康；歧义来源不能为任务完成而无条件覆盖。本轮不重复 Checksum / Silent Corruption 基础。

## 后续规划

- Capacity Management。
- Recovery Observability。
- Metrics / Logs / Tracing。
- SLI / SLO。
- Failure Drill / Troubleshooting。

以上仍为规划，不表示已有正文。本章当前止于三阶段七篇，不提前展开 Capacity Management、完整 Observability 或 DR 专题。

[数据保护机制](../07-data-protection/README.md) · [返回 Knowledge Map](../../README.md)
