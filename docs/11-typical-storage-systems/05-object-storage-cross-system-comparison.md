# Object Storage Cross-system Comparison：相同问题，不同架构边界

## 页面定位、比较范围与证据

本篇承接 [Comparison Framework](01-comparison-framework.md)，比较 **Ceph RGW / RADOS、MinIO AIStor、OpenStack Swift** 怎样划分对象服务的状态、放置、保护和恢复职责。产品事实只取自 [Ceph 案例](02-ceph-rgw.md)、[MinIO 案例](03-minio.md)、[Swift 案例](04-openstack-swift.md)，不重新拼接三篇产品百科。

| 案例 | 继承的资料范围 | 使用边界 |
| --- | --- | --- |
| Ceph RGW / RADOS | Tentacle 20.2.x 稳定分支 | 普通单站点 RGW 与 RADOS 机制 |
| MinIO AIStor | 当前 `/aistor/` 滚动文档 | 不无条件继承历史开源版行为 |
| OpenStack Swift | 2026.2 稳定系列、2.38.2 tag 核对 | 原生 API、普通 Replication / EC 与常规后端 |

资料核对日期均为 **2026-10-02**。本文不再宣称“最新产品行为”；具体事实与限制以原案例及其官方来源为准。以下表格标为**事实对照**时仅压缩已有证据；标为**工程分析**时是架构推导，必须用 Workload、Scale、Protection、Hardware、Deployment 与 Failure Model 验证。没有证据的 ACK / 一致性细节保留未知，不填成评价分数。

## 1. Overall Architecture：职责边界在哪里？

**事实对照：** 三者都处理对象请求，但进入的内部状态模型不同。逻辑路径不等于固定 RPC 次数；下表中的分组和算法也不是必须经过的独立网络服务。

| 系统 | 对象请求到存储的逻辑关系 | 主要服务边界 |
| --- | --- | --- |
| [Ceph §1](02-ceph-rgw.md#1-system-position) | Client → RGW → librados / RADOS → OSD | Object API 层与底层共享存储后端 |
| [MinIO §1](03-minio.md#1-system-position) | Client → AIStor Server → Set / Drives | Server 内组合 S3 处理、对象定位与保护 |
| [Swift §1](04-openstack-swift.md#1-system-position) | Client → Proxy → Account / Container / Object Servers | Namespace 与正文的不同服务职责 |

**工程分析：** “都有入口节点”不足以预测后端故障边界。RGW 需要把 API 状态映射到 RADOS；AIStor 需要协调对象与 Set 分片；Swift Proxy 需要组合不同 Namespace / Object 职责。分析入口故障、Metadata 变慢或保护不足时，后续要追踪的状态不一样。

## 2. Metadata Architecture：三套系统都有 Metadata

**事实对照：** [Ceph §3](02-ceph-rgw.md#3-metadata)、[MinIO §3](03-minio.md#3-metadata)、[Swift §3](04-openstack-swift.md#3-metadata) 记录了不同组织方式。

| 问题 | Ceph RGW | MinIO AIStor | Swift |
| --- | --- | --- | --- |
| 对象状态表示 | Head Attributes / Manifest | 共置 Metadata、`xl.meta` | Object Metadata / xattrs、EC 状态 |
| Namespace / 索引职责 | RADOS-backed Bucket Index | 分布式对象相关 Metadata；精确全套 schema 未在案例确定 | Account / Container 数据库与列表职责 |
| 独立集中数据库？ | 不能把 RADOS-backed Index 当作单一集中服务 | 官方描述没有独立集中 Metadata Database | SQLite 文件分散复制，不是全局一个数据库 |

**工程分析：** 真正的问题是索引粒度、更新与恢复依赖，不是“有 / 没有 Metadata”。共置可能减少独立服务边界，却仍占用 I/O 与 CPU；分开 Namespace 职责可能提供不同扩展边界，却需要处理列表与正文的状态关系。一个数据库文件的存在也不能说明系统集中化。

## 3. Partition / Placement：PG、Set、Ring Partition 并非同一抽象

**事实对照：** 依据 [Ceph §4](02-ceph-rgw.md#4-partition--placement)、[MinIO §4](03-minio.md#4-partition--placement)、[Swift §4](04-openstack-swift.md#4-partition--placement)。

| 架构问题 | Ceph | MinIO AIStor | Swift |
| --- | --- | --- | --- |
| Logical Grouping | Pool 内 RADOS Objects → PG；Index Shard 另有职责 | Pool 内对象 → Erasure Set | 路径 Hash → Ring Partition |
| Placement Mechanism | CRUSH Rule / Map，加实际 OSDMap / Acting Set | Pool 选择、Set 定位与 Drives 布局 | 构建并分发 Partition → Devices 分配 |
| Failure-domain Input | CRUSH 拓扑与 Rule | 分片跨 Drives / Nodes 的部署拓扑 | Region / Zone / Server / Device 与 Weight |
| Runtime Routing | RGW 状态解析与 librados 定位 | 接入 Server 定位对象并内部通信 | Proxy 查相应 Ring、选择节点 |

**工程分析：** PG 是底层对象分组与保护状态边界的一部分；Erasure Set 是编码成员组；Ring Partition 是 Keyspace 分组及成员分配输入。它们都帮助减少“逐对象任意选择资源”的复杂度，却没有相同大小、生命周期或重映射方式。

Ring 与 CRUSH 的共同目标是位置选择，关键差别是：Swift 路径 Hash 得到 Partition，再读取持久分配结构；Ceph 在 Pool / PG、拓扑规则与 Map 基础上计算并解析实际成员。前者的 Ring Builder / 分发与后者的 Map / 布局变化不能相互替换。AIStor 的 Pool / Set 定位又是另一种组合，不能把它叫作不使用 PG 的 CRUSH。

复用 [Partitioning ≠ Placement ≠ Routing](../08-consistency-metadata-partitioning/03-partition-ownership-routing.md)，可以避免把“知道目标位置”误认为“取得修改资格”，或把逻辑分组误当一份物理副本。

## 4. Protection Model：保护机制在哪一层工作？

**事实对照：** 三个 [§5](02-ceph-rgw.md#5-data-protection) / [§5](03-minio.md#5-data-protection) / [§5](04-openstack-swift.md#5-data-protection) 案例将机制落在不同层次。

- Ceph：Replicated / EC Pool 保护 RADOS 数据；RGW Index 等状态有自己的 Pool 与能力约束。
- AIStor：对象编码表示围绕 Erasure Set / Drives 组织；本地 EC 不是跨 Pool / 跨站点复制的同义词。
- Swift：Container 选择 Storage Policy，Policy 的 Object Ring 与后端机制实现 Replication 或 EC；Account / Container 数据库保护另有路径。

**工程分析：** 不应只比较“支持 EC”。应该问一次对象状态发布需要哪些受保护材料：正文、布局、索引、提交资格，以及这些材料在哪些故障域上。三个系统的 Fragment / 后端 Object / API Object 不能用同一对象数量直接换算成本。

## 5. Data Path：入口 Hop 能说明多少？

**事实对照：** 依据三篇案例的 Read / Write Path。RGW 和 Swift Proxy 参与常规客户端正文路径；AIStor 接入 Server 处理 S3 和内部对象通信，没有按案例建模出的 RGW → RADOS 独立层次。Swift EC 的前台编码 / 解码由 Proxy 承担。

**工程分析：** 图上少一层不直接证明 Memory Copy、RPC 或 CPU 更少；“没有独立 Gateway”也不等于客户端直接访问本地磁盘。需要跟踪入口如何拿到远端分片、谁做编码、谁等待下游，以及正文是否经过同一组资源。

写入条件不能简化成统一“W 份成功”：Ceph 案例保留 API Commit 与 RADOS 写入的层次边界；AIStor 案例区分 Write Quorum 与等待全部 Drive 结果；Swift 案例区分 replicated 响应条件与普通 EC 的分阶段 Commit。**公开资料不足以做所有设备、配置和异常条件下完全等价的 Durability ACK 比较。** 这不是性能优劣结论。

## 6. Metadata Path vs Data Path：耦合方式改变什么？

以下为**工程分析**，基础事实来自三篇 Metadata 与路径章节。

| 决策 | 可能增加的诊断或运维责任 | 不应推导的结论 |
| --- | --- | --- |
| RGW Metadata / Index 使用 RADOS | 关联 API、Index / Pool 与 PG / OSD 的压力和故障 | 正文 Pool 健康代表全部 Namespace 健康 |
| AIStor 对象 Metadata 共置 | 关联对象数、Metadata 工作与分片 / Drive 资源 | 没有独立数据库，所以不会有 Metadata 瓶颈 |
| Swift Namespace / Object 职责分开 | 关联数据库服务、待更新状态与正文服务 | 分开服务天然完全故障隔离或始终同步 |

这些边界可以影响独立扩容、热点分布、调用路径和故障定位。但逻辑职责分开与资源物理隔离也不同：部署在同一设备、网络或节点上时，仍可能相互竞争。

## 7. Consistency：按观察对象比较，不贴单一标签

**事实对照：** 仅使用各案例 [Ceph §8](02-ceph-rgw.md#8-consistency-boundary)、[MinIO §8](03-minio.md#8-consistency-boundary)、[Swift §8](04-openstack-swift.md#8-consistency-boundary) 已确认的范围。

| 观察范围 | Ceph RGW | MinIO AIStor | Swift |
| --- | --- | --- | --- |
| Object | 文档说明对象 Read-after-write | 官方概括 atomic / strictly consistent；精确扩大范围保留未知 | 正常成功 PUT 后可读；故障副本分歧需收敛 |
| Namespace / Listing | Bucket Index 文档包含 LIST 可见性 | 案例未取得所有 LIST 并发 / 分页的精确形式化保证 | Container Listing 更新可以滞后正文 |
| 全部 Metadata 状态 | 不从对象 / Index 保证推广 | 不从概括推广到所有内部记录 | Account / Container 更新与复制独立观察 |
| 后台 / 远端传播 | 单站点保证不代表全部保护已收敛 | 单集群保证不代表异地保护完成 | 更新、复制、重建收敛不等于一次对象响应 |

**工程分析：** 客户端若要“写入后通过 LIST 找到新对象”，依赖的状态边界与直接 GET 不同。分页 Namespace 快照、多对象事务和全部故障场景的 Linearizability 不能由表中简述推得。材料不足时宁可留下缺口，不做“强一致 / 强一致 / 最终一致”的三格排名。

## 8. Failure Recovery：谁发现，谁确认，谁搬，怎样收敛？

**事实对照：** 参照 [Ceph §9](02-ceph-rgw.md#9-failure-recovery)、[MinIO §9](03-minio.md#9-failure-recovery)、[Swift §9](04-openstack-swift.md#9-failure-recovery)。

| 恢复职责 | Ceph | MinIO AIStor | Swift |
| --- | --- | --- | --- |
| 确认所需状态 / 来源 | PG Peering 与后端历史、状态 | Healing 所需对象状态与足够有效 Shards | Timestamp / 分片资格、Replica 比较 |
| 补回字节与保护 | Recovery / 必要 Backfill | 请求或后台 Healing | Replicator / EC Reconstructor |
| 发现完整性问题 | Scrub / Deep Scrub | Bitrot 检查、Scanner 的条件性检查 | Auditor / Quarantine |
| 还需观察的状态 | PG 可服务与保护恢复 | 对象可读与全部 Shards 恢复 | 正文收敛与 Namespace Updater 进度 |

**工程分析：** 这不是 Daemon 数量比较。Peering 不是 Copy 完成，Scanner 不是无条件全文校验，Updater 也不是 EC 重建器。通用 [Repair 完成条件](../10-recovery-operations-observability/02-repair-rebuild.md) 帮助追问：来源正确吗？目标有效吗？状态引用生效吗？保护缺口是否消失？具体资格判断仍需产品模型。

## 9. Expansion / Rebalance：扩容不是同一种过程

**事实对照：** 依据三个案例的 Rebalance / Expansion。

| 问题 | Ceph | MinIO AIStor | Swift |
| --- | --- | --- | --- |
| 新资源如何进入布局 | OSD / CRUSH / Map 改变与 PG 重映射 | 增加 Server Pool | Device / Weight 输入 Ring Builder |
| 已有数据如何变化 | 新布局触发后台补齐，Balancer 可调整分布 | 新 Pool 不自动平衡旧对象；显式 Rebalance 移动 | 新 Ring 分配后由保护后台向目标布局收敛 |
| 必须分开的状态 | PG Remap 与 Backfill 完成 | 容量新增、新写入分配、旧对象移动 | Ring 分发与真实内容搬迁 |

**工程分析：** “加节点”不能作为跨系统相同实验条件：新增资源可能改变不同保护组与数据量，也可能只改变新写入落点。比较收敛成本需要记录实际移动量、旧 / 新状态、保护缺口、后台资源预算与前台延迟。环或 Map 看起来平衡，不证明字节、请求、容量和故障域余量都平衡。

## 10. Integrity：比较检查层级和 Coverage

**事实对照：** [Ceph §11](02-ceph-rgw.md#11-integrity) 区分 Scrub 与读取数据的 Deep Scrub；[MinIO §11](03-minio.md#11-integrity) 区分请求检查、Bitrot 与默认 Scanner 覆盖；[Swift §11](04-openstack-swift.md#11-integrity) 描述 Auditor / DiskFile 校验与 Quarantine。

**工程分析：** 不能按是否出现 “scrub” 这个名字比较完整性。应问校验针对后端单元、Fragment Archive、Object 组装还是 Namespace；是否读取全文；未访问、跳过、不可达范围怎样记录；发现无效来源后由谁恢复。三者都不能把“某项检查通过”扩展为应用原始输入正确、所有冗余来源已验证或 Freshness 已证明。

## 11. Operational Model：Operator 看见哪些状态？

**事实对照：** Ceph 暴露 Health / PG States、容量与恢复信息；AIStor 提供 Health、Metrics / Logs / Traces 与任务状态；Swift 的 Recon、Metrics / Transaction Logs 对应容量、Ring 和后台证据。具体字段与启用条件见各案例 §12。

**工程分析：** 观察模型要服务于架构边界，而非服务于一个漂亮 Dashboard。Ceph 需要从 API 往 PG / OSD 关联；AIStor 需要区分对象、Pool / Set / Drive 与 Healing；Swift 需要把请求、Namespace 待更新和保护收敛关联起来。API Available 与 Available-but-at-risk 的区别，在三个系统都值得检查；不能仅用进程在线代表保护健康。

## 12. Performance Cost Model：Architecture → Potential Cost Location

以下为**工程分析**，不是跑分。回到 [End-to-End Cost Model](../09-data-path-performance/01-end-to-end-cost-model.md) 和 [Foreground / Background Interference](../09-data-path-performance/06-foreground-background-interference.md)。

| 架构条件 | 潜在成本位置 | 如何避免错误归因 |
| --- | --- | --- |
| RGW / Proxy / S3 Server 入口 | Protocol CPU、网络、Buffer、连接等待 | 不以逻辑层数代替测量 RPC、Copy 与排队 |
| Index / 共置 Metadata / Namespace DB | Lookup、LIST、固定请求成本、热点 | 区分小对象 / LIST 比例与正文吞吐 |
| Replica / EC Fan-out | 网络、Encode / Decode、下游尾延迟 | 固定保护与失败状态，不只固定对象大小 |
| 本地 Device Path | I/O、Queue 与等待 | 不把 Disk Utilization 当作全部延迟的因果证明 |
| Repair / Heal / Rebalance / Audit | 共享 CPU、网络、设备和控制路径 | 同时报告后台工作量与前台 P99 |

架构推导的价值是提出可检验假设。例如 LIST 慢而大对象 GET 正常，应追踪 Namespace 与 Metadata 路径；EC 故障读慢，要区分来源选择、重建和队列。它们不是机械诊断规则，更不能变成“某产品一定最快”的结论。

## 13. Architecture Decision Summary

这是短索引，详细证据与条件仍在正文及各案例。

| Architecture Question | Ceph RGW | MinIO AIStor | OpenStack Swift |
| --- | --- | --- | --- |
| Frontend Model | RGW / RADOS 分层 | S3 Server 与对象存储职责组合 | Proxy 组合专门服务 |
| Metadata Organization | RADOS-backed Head / Index | 与对象共置 | Namespace DB + Object Metadata |
| Placement Abstraction | Pool / PG / CRUSH / Map | Pool / Erasure Set | Ring Partition / Devices |
| Protection Layer | RADOS Pool | 对象编码组 | Storage Policy / Object Ring |
| Recovery Mechanism | Peering / Recovery / Backfill | Healing | Replicator / Reconstructor / Updater |
| Expansion Model | 布局变化与后台补齐 | 新 Pool；显式旧数据平衡 | Ring 重分配与后台收敛 |
| Integrity Mechanism | Scrub / Deep Scrub | Bitrot / 条件性 Scanner | Auditor / Quarantine |

## 14. What the Generic Model Got Right

这里检验的是通用区分是否仍然有用，不是声称所有产品采用统一模板。

- **Partitioning ≠ Placement ≠ Routing：** PG / CRUSH、Pool / Set、Ring Partition 都可以拆成分组、布局依据与本次请求定位，避免把三个名字当同一个组件。
- **Replication / EC ≠ Recovery：** 保护配置说明需要什么冗余，Recovery / Healing / Reconstructor 则在故障或布局变化后重新建立它。配置正确不代表当前保护完整。
- **Integrity Detection ≠ Repair：** Deep Scrub、Bitrot 检查和 Auditor 可以识别问题；是否有可信来源、是否补回并验证，是另一组条件。
- **Data Transfer Finished ≠ State Committed：** 后端字节、对象可见性、Namespace 与保护布局各有边界，特别能解释 Swift 列表滞后和 Ring 更新未搬完数据。
- **Critical Path ≠ Total Resource Consumption：** 后台恢复 / 验证虽然不必属于某次 GET 的调用链，仍可通过共享资源改变 P99。

这些区分使既有 [Metadata](../08-consistency-metadata-partitioning/02-metadata-object-index.md)、[Placement](../07-data-protection/03-failure-domain-placement.md)、[Repair](../10-recovery-operations-observability/02-repair-rebuild.md) 与性能模型能够解释案例，无需重新发明一套通用机制。

## 15. Where Product-specific Models Still Matter

通用模型有意忽略 exact Metadata Schema、API Commit Protocol、具体 Placement Algorithm、Scheduler、Daemon Topology 与产品运行状态。它能提示“查什么”，不能替代“该版本究竟怎样实现”。

例如，知道要验证 Generation，不足以正确解释 Swift Timestamp / durable 状态；知道要跨故障域放置，不足以运行 CRUSH Rule 或 Ring Builder；知道要看后台进度，也不能把 PG State、Healing 状态与 Recon 计数互换。精确 ACK、失败分支和 Namespace 契约仍需要各案例记录的官方资料与版本条件。

因此 **Generic Model 是 Reasoning Framework，不是统一实现模板**。本轮完成对象存储的三系统案例链；Block / File 案例只按后续需要扩展，不继续增加对象产品或进入 AI Storage。

[OpenStack Swift](04-openstack-swift.md) · [比较框架](01-comparison-framework.md) · [返回专题入口](README.md)。
