# Failure Recovery / Operations / Observability

## 页面定位

从故障信号到保护恢复，再进入主动数据移动与布局维护。第一阶段建立最小 Failure Recovery 闭环，第二阶段建立 Rebalance、Online Data Migration 与 Node Evacuation 的目标、切换和退出边界，第三阶段承接 Data Integrity 机制，建立主动验证与安全完整性修复，第四阶段把运行余量、持续证据与健康目标连接起来，第五阶段把跨域与历史材料转化为灾难后的业务恢复，第六阶段用受控故障验证运行假设，并把观测证据用于诊断真实问题。

## 核心问题

- 如何区分短暂不可达、永久故障与数据损坏？
- 如何确定受影响数据，安全安排恢复任务并验证结果？
- Repair 如何检查 Generation、Ownership、Placement 与提交结果？
- 如何兼顾恢复窗口和前台 I/O，避免 Recovery Storm？
- 如何区分平衡、迁移与撤离的目标，安全处理并发更新和旧资格？
- 如何确认新布局可用，以及节点不再承担必须保留的责任？
- 长期不读取的数据如何获得验证，怎样区分扫描覆盖、修复完成与当前健康状态？
- 集群还有多少安全写入和恢复余量，怎样避免总体平均值隐藏局部容量风险？
- 哪些信号支持运行判断，怎样区分服务目标、可行动告警与内部可靠性风险？
- 大范围服务域不可用后，怎样选择恢复点、切换合法资格，并验证 RPO / RTO 与服务恢复？
- 怎样在已知基线、受限影响范围和 Abort Condition 内，验证故障后的服务、保护与恢复行为？
- 怎样从 Symptom / Scope 建立可反驳的假设，关联证据并验证修复，而不把症状消失当作系统健康？

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

## 已完成第四阶段：Operational Health / Observability

推荐顺序：**Capacity Management → Observability Signals → SLI / SLO / Alerting**。

| 顺序 | 正文 | 回答的问题 |
| --- | --- | --- |
| 8 | [Capacity Management](08-capacity-management.md) | 还有多少安全运行余量？区分容量口径、合格目标、Headroom、水位与准入 |
| 9 | [Observability Signals](09-observability-signals.md) | 通过什么证据知道发生了什么？区分 Metrics / Logs / Traces / Events，关联身份并控制采集成本 |
| 10 | [SLI / SLO / Alerting](10-sli-slo-alerting.md) | 怎样定义健康并发出可行动告警？区分服务结果、目标、预算与内部风险，不把代理指标当作持久性概率 |

第四阶段形成 **Resource / Risk State → Evidence → Health Objective**：把前三阶段的 Repair、移动与 Scrub，以及 Data Path 的 Queueing / P99，连接为持续运行的 Operational View。Benchmark 是受控实验，Observability 是持续生产证据；本阶段不重复性能测试方法，也不展开完整 Troubleshooting。

## 已完成第五阶段：Disaster Recovery

前置按 **[Cross-region Protection](../07-data-protection/06-cross-region-protection.md) → [Backup / Restore](../07-data-protection/07-backup-restore.md)** 阅读，再进入本章正文。

| 顺序 | 正文 | 回答的问题 |
| --- | --- | --- |
| 11 | [Disaster Recovery / RPO / RTO](11-disaster-recovery-rpo-rto.md) | 恢复材料怎样成为可服务状态？区分恢复点、时间目标、Authority / Fencing、Failover / Failback 与验证条件 |

07 维护 Protection Mechanism / Recovery Material，本章承接 **合法资格 → 有效恢复状态 → 服务激活与验证**。不重复跨域复制或 Backup 基础，不把远端副本存在、字节复制完成或流量已切换直接当作业务恢复。

## 已完成第六阶段：Operational Validation / Troubleshooting

推荐顺序：**Failure Drill → Troubleshooting Method**。

| 顺序 | 正文 | 回答的问题 |
| --- | --- | --- |
| 12 | [Failure Drill](12-failure-drill.md) | 设计假设在实际部署中成立吗？定义基线、故障假设、Blast Radius 与 Abort Condition，验证服务、保护和恢复结果 |
| 13 | [Troubleshooting Method](13-troubleshooting-method.md) | 如何从症状形成可验证的原因判断？缩小范围，关联跨层证据，寻找反证并区分缓解、恢复与根因修复 |

第六阶段形成 **Observe → Validate Failure Behavior → Diagnose Real Problems**。Observability 不只收集信号，还应支持演练判定与假设检验；任务完成或症状消失，都不能替代保护、完整性和积压收敛的验证。复用已有 Recovery、Queueing 和 Observability 机制，不展开故障注入工具或产品 Runbook。

## 后续规划

- Incident Timeline / Postmortem。

以上仍为规划，不表示已有正文。本章当前止于六阶段十三篇，不提前展开完整 Incident Response、Postmortem 或工具配置。

[数据保护机制](../07-data-protection/README.md) · [返回 Knowledge Map](../../README.md)
