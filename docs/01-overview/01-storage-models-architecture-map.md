# Storage Models / Architecture Map：进入分布式存储的统一坐标

面对一个存储系统，先问三个问题：**客户端用什么身份访问状态，系统替应用承担什么责任，一次操作经过哪些逻辑职责？** 这比先按产品名字分类更能帮助阅读后续章节。本文只建立坐标，不重复根目录的建设状态，也不深入 Block / File 实现。

## 1. Block / File / Object：不同的是访问模型与责任边界

| 维度 | Block | File | Object |
| --- | --- | --- | --- |
| Client-visible identity | Volume + Logical Block Address（LBA） | Path / Directory / File；打开后也可通过文件句柄访问 | Bucket / Key / Object；接口支持时指定 Version |
| Access unit | 某段逻辑块范围 | 文件内字节范围及文件 / 目录操作 | 完整对象或 Range 等接口定义的范围 |
| Namespace | 卷内块地址空间；通常不理解上层文件名 | 目录层次与文件命名空间 | Bucket 内 Key 空间；Key 中的分隔符不自动产生文件目录语义 |
| Update model | 按接口约束覆盖块范围 | 写入范围、截断及命名空间修改；保证依文件接口而定 | 常见为创建 / 替换对象、删除或版本操作；不暴露任意 LBA 覆盖 |
| Metadata responsibility | 管理卷、块映射和设备属性；Filesystem / Database layout 通常由上层负责 | 管理 Namespace、文件属性与共享访问所需状态 | 管理对象身份、属性、版本与正文引用；不解释正文内部记录 |
| Typical sharing model | 单主机使用或受协调的共享卷；多主机访问需要上层协调 | 多客户端共享命名空间，协调缓存、锁与访问语义 | 多客户端通过对象接口访问，按对象条件、版本及一致性契约协调 |
| Common workload shape | 数据库页、虚拟机磁盘、上层文件系统 I/O | 文件读写、目录遍历、小文件及共享工作目录 | Blob 上传 / 下载、Range 读取、对象列举与版本访问 |

Block 暴露“卷里的哪个位置”，上层通常负责把这些位置解释为文件或数据库页。File 把这部分命名与文件元数据责任纳入系统，还要兑现共享访问契约。Object 暴露“哪个名字的哪份内容与属性”，完整对象写入和 Range 读取并不等同于任意底层块更新。表中是典型抽象，具体更新、原子性和共享保证仍需查接口契约。

三者可以叠加：文件系统可以建立在块设备上，对象服务可以把内部单元存为文件。**内部实现用了文件，不会因此把客户端对象接口变成 File Storage。** 外部访问模型与内部布局是不同坐标，详见 [Object Model](../03-object-storage/01-object-model.md)。

这不是性能排名。Workload、Request Size、Metadata Operation、Cache、Network、Protection、Implementation 与 Hardware 一起决定性能，不能无条件排列“Block 快、File 居中、Object 慢”。

## 2. 从 Local 到 Distributed：增加的是跨节点责任

可沿下面的逻辑层次追踪请求：Application → Access Interface → Frontend / Gateway → Metadata / Routing / Placement → Storage Nodes → Media。

| 逻辑位置 | 需要回答什么 | 可能的实现方式 |
| --- | --- | --- |
| Application / Access Interface | 使用什么身份、操作什么范围、期待什么结果？ | 本地调用、文件接口、块协议或对象 API |
| Frontend / Gateway | 谁解析请求、接入并返回结果？ | 独立网关、节点内接口或客户端直连 |
| Metadata / Routing / Placement | 选哪份状态、谁负责、字节在哪里？ | 独立服务、节点内分散状态、算法映射或与 Object Data 共置 |
| Storage Nodes | 谁执行正文、保护与恢复工作？ | 一个节点兼任多种职责；不要求单独的数据进程 |
| Media | 什么设备保存字节、何时达到持久化条件？ | 本地设备及其控制器、缓存和介质 |

**Logical Responsibility ≠ Independent Service。** 表不规定每次操作都按顺序访问全部位置，缓存、客户端布局缓存或直连路径可以改变执行路径。Metadata Responsibility 也不等于必有中心 Metadata Server。带着这些问题读 [Typical Storage Systems](../11-typical-storage-systems/README.md)，才能比较职责放在哪，而不是机械数服务框。

## 3. Control / Metadata / Data 是三条职责路径

| 路径 | 回答的问题 | 典型信息 / 工作 |
| --- | --- | --- |
| Control Path | 系统按什么配置和规则运行？ | Configuration、Membership、Placement Map、Policy 的维护与分发 |
| Metadata Path | 当前操作的是哪份状态，谁拥有它，如何定位？ | Identity、Lookup、Version、Layout Reference、Ownership 的查询和修改 |
| Data Path | 正文及保护字节实际怎样移动？ | Memory、Network、Device 之间的传输与处理 |

**Control Plane ≠ Metadata Plane ≠ Data Plane**，但它们可以在同一进程、同一连接甚至同一设备上实现。管理面更新 Placement Map，与请求使用该 Map 定位对象，是不同职责；一个对象写入也可能同时触发 Metadata 更新与 Data 传输。

已有 [Object Read / Write Path](../03-object-storage/03-read-write-path.md) 与 [End-to-End Cost Model](../09-data-path-performance/01-end-to-end-cost-model.md) 将请求控制信息合称 Metadata / Control Path，那里的 Control 是广义请求控制，不是专指此处配置和成员管理的 Control Plane。阅读时按信息的职责区分，不能把合并画图理解为三个概念完全相同。

## 4. 单机问题如何升级为分布式问题

| Local Storage Question | Distributed Storage Question | 深入入口 |
| --- | --- | --- |
| 写完成了吗？ | 哪些节点完成？Metadata 是否发布？Protection 条件是否满足？Client 收到结果了吗？Timeout 后是否未知？ | [读写提交](../03-object-storage/03-read-write-path.md)、[Replication ACK](../07-data-protection/01-replication.md) |
| 设备失效了吗？ | 是节点、网络还是部分路径不可达？其他节点观察是否一致？ | [Failure Model / Timeout](../06-distributed-systems/01-failure-model-timeout.md) |
| 字节在哪里？ | 哪份 Replica / Fragment 合格，Placement 是否满足故障域约束？ | [Data Protection](../07-data-protection/README.md) |
| 谁能修改？ | 当前 Ownership 与修改资格是什么，旧执行者是否被拒绝？ | [Ownership / Routing](../08-consistency-metadata-partitioning/03-partition-ownership-routing.md) |
| 失败后再写一次？ | Retry 会不会重复效果，原结果能否判定？ | [Retry / Idempotency](../06-distributed-systems/03-retry-idempotency-deduplication.md) |
| 如何恢复本地状态？ | 怎样补齐保护、协调 Recovery，与 Background Work 分享资源？ | [Recovery / Operations](../10-recovery-operations-observability/README.md) |
| 本地指标正常吗？ | 各节点及请求路径的证据是否关联，局部健康能否代表服务？ | [Observability](../10-recovery-operations-observability/09-observability-signals.md) |

分布式化引入 Partial Failure、Network、冗余、Placement、Ownership、Retry、Recovery 与分布式观测；它没有取消单机持久化责任。节点 ACK 的含义仍要从 [I/O Path / Persistence](../02-storage-fundamentals/01-io-path-persistence.md) 追到实际确认点。

## 5. Architecture Goals：先说目标，再谈取舍

| 目标 | 所关心的事情 |
| --- | --- |
| Capacity | 能保存多少逻辑数据，保护与运行余量占用多少空间 |
| Latency | 指定请求完成边界内的时间，包括尾部 |
| Throughput | 单位时间完成多少有效工作 |
| Availability | 当前故障条件下能否按契约提供服务 |
| Durability | 已承诺状态能否在选定故障模型后保留 |
| Integrity | 字节及其身份是否正确，损坏能否检测与处理 |
| Cost | 设备、容量、网络、计算及持续运营的代价 |
| Operability | 能否观测、诊断、恢复并安全改变系统 |

这些目标可能冲突。例如增加冗余可能提高保护能力，也增加 Capacity / Network / Repair Cost；减少响应等待不能擅自降低 Durability 契约。没有统一权重或脱离 Workload 与故障模型的最佳方案。

## 6. 用坐标选择下一篇

| 当前问题 | 章节入口 |
| --- | --- |
| Access Model | [03 Object](../03-object-storage/README.md) / [04 Block](../04-block-storage/README.md) / [05 File](../05-file-storage/README.md)；后两章保留类型入口 |
| Local I/O / Persistence / Device Cost | [02 Storage Fundamentals](../02-storage-fundamentals/README.md) |
| Distributed Coordination | [06 Distributed Systems](../06-distributed-systems/README.md) |
| Protection | [07 Data Protection](../07-data-protection/README.md) |
| Metadata / Ownership | [08 Consistency / Metadata / Partitioning](../08-consistency-metadata-partitioning/README.md) |
| Data Path | [09 Data Path / Performance](../09-data-path-performance/README.md) |
| Recovery / Operations | [10 Recovery / Operations](../10-recovery-operations-observability/README.md) |
| Real Systems | [11 Typical Storage Systems](../11-typical-storage-systems/README.md) |
| AI Workload | [12 AI Storage Connections](../12-ai-storage-connections/README.md) |

本文对照表与职责模型是通用架构归纳，不是特定产品保证。机制与公开来源由链接的专题维护；读者可按问题进入正文，无需把目录编号当作严格依赖顺序
