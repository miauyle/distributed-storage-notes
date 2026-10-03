# Object Storage

## 页面定位

知识库的重点主线：从对象访问模型到完整读写链路，系统梳理对象存储的语义、内部职责与工程取舍。后续内容深度和篇幅应明显高于 Block / File；S3 作为重要接口实例，不等同于所有对象存储实现。

## 已有正文与阅读顺序

按 **Object Model → S3 Core Semantics → Read / Write Path → Multipart Upload → Versioning / Delete → Object Layout** 阅读。前六篇正文已完成：先建立身份、操作和提交模型，再区分上传会话、历史版本及内部存储单元。报告对象与归档上传示例连接这条知识链。

| 顺序 | 文章 | 阅读后应理解的问题 |
| --- | --- | --- |
| 1 | [Object Model：对象身份、内容与底层布局](01-object-model.md) | Bucket / Object / Key、Data / Metadata、Version，以及对象与物理单元、文件、块的差别 |
| 2 | [S3 Core Semantics：操作如何改变对象状态](02-s3-core-semantics.md) | PUT / GET / HEAD / DELETE / LIST 的原子性、可见性、覆盖、条件与重试边界 |
| 3 | [Read / Write Path：从请求到可读状态](03-read-write-path.md) | 鉴权、元数据、放置、正文传输、持久化、发布和响应如何协作 |
| 4 | [Multipart Upload：上传会话与对象发布](04-multipart-upload.md) | Part 的准备、替换、Complete / Abort 与未完成上传资源 |
| 5 | [Versioning / Delete：当前状态、历史版本与删除标记](05-versioning-delete.md) | Current / Noncurrent、版本寻址、普通删除与指定版本删除 |
| 6 | [Object Layout：逻辑对象与物理单元的解耦](06-object-layout.md) | 大对象分块、小对象聚合、映射成本、放大与空间回收边界 |

具体 S3 行为以 AWS general purpose bucket 为主要范围，版本状态等前提由各篇明确指定，来源核对日期写在正文中。读写流程与内部布局图属于通用架构示意；API Part、Object Version 与 Internal Storage Unit 不混为同一层。Data Protection、Consistency / Metadata / Partitioning 与 Recovery / Operations 均已有正文，相关机制由对应章节承接。

## 核心问题

- Bucket、Object、Key、Version 与 Metadata 分别承担什么职责？
- PUT / GET / HEAD / LIST / DELETE 与 Multipart Upload 有哪些语义边界？
- 一次请求如何完成寻址、权限检查、元数据更新与数据持久化？
- 并发覆盖、失败重试、部分上传和版本删除如何影响对象状态？
- 小对象、大对象与海量对象会产生哪些不同的成本？
- 生命周期、跨区域复制和租户隔离如何连接底层机制？

## 后续准备展开的主题（尚未撰写）

- Lifecycle Policy：对象 API / Version 生命周期语义及当前 / 历史版本的到期与保留策略；仅保留规划，不等同于物理回收。
- Garbage Collection：对象状态到物理回收的连接，仅保留规划；Metadata 引用有效性与回收资格由 08 承担。
- 对象级 / Bucket 级复制：对象 / Bucket API 级的触发、顺序、重试、冲突与复制状态；不重复 07 的通用复制与跨区域保护机制。
- 多租户与服务边界：认证授权、配额、隔离与接口可观测性；保留服务边界规划，不扩成安全大专题。

复制和纠删码的通用机制见[数据保护](../07-data-protection/README.md)；一致性与索引机制见[一致性 / 元数据 / 分区](../08-consistency-metadata-partitioning/README.md)；故障恢复与运行验证见[恢复与运维](../10-recovery-operations-observability/README.md)。这些章节均已有正文；本章六篇建立对象语义与布局边界，不重复对应机制。

[返回 Knowledge Map](../../README.md)
