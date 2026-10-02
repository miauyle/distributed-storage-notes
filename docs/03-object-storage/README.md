# Object Storage

## 页面定位

知识库的重点主线：从对象访问模型到完整读写链路，系统梳理对象存储的语义、内部职责与工程取舍。后续内容深度和篇幅应明显高于 Block / File；S3 作为重要接口实例，不等同于所有对象存储实现。

## 已有正文与阅读顺序

按 **Object Model → API Semantics → Read / Write Path** 阅读。三篇贯穿同一个报告对象的覆盖示例，依次回答“访问什么”“操作改变什么状态”“系统如何兑现这些状态承诺”。

| 顺序 | 文章 | 阅读后应理解的问题 |
| --- | --- | --- |
| 1 | [Object Model：对象身份、内容与底层布局](01-object-model.md) | Bucket / Object / Key、Data / Metadata、Version，以及对象与物理单元、文件、块的差别 |
| 2 | [S3 Core Semantics：操作如何改变对象状态](02-s3-core-semantics.md) | PUT / GET / HEAD / DELETE / LIST 的原子性、可见性、覆盖、条件与重试边界 |
| 3 | [Read / Write Path：从请求到可读状态](03-read-write-path.md) | 鉴权、元数据、放置、正文传输、持久化、发布和响应如何协作 |

具体 S3 行为以 AWS general purpose bucket 为主要范围，来源核对日期写在正文中；读写流程图明确属于通用架构示意。其他一级章节仍保持原有骨架。

## 核心问题

- Bucket、Object、Key、Version 与 Metadata 分别承担什么职责？
- PUT / GET / HEAD / LIST / DELETE 与 Multipart Upload 有哪些语义边界？
- 一次请求如何完成寻址、权限检查、元数据更新与数据持久化？
- 并发覆盖、失败重试、部分上传和版本删除如何影响对象状态？
- 小对象、大对象与海量对象会产生哪些不同的成本？
- 生命周期、跨区域复制和租户隔离如何连接底层机制？

## 后续准备展开的主题（尚未撰写）

- Multipart Upload：分片、完成、取消与未完成上传的清理。
- 底层对象布局的深入取舍：分块、聚合与小对象成本。
- 版本控制与生命周期：覆盖、删除标记、保留和垃圾回收。
- 对象级 / Bucket 级复制：触发、顺序、重试、冲突与复制状态。
- 多租户与服务边界：认证授权、配额、隔离与接口可观测性。

复制和纠删码的通用机制见[数据保护](../07-data-protection/README.md)；一致性与索引机制见[一致性 / 元数据 / 分区](../08-consistency-metadata-partitioning/README.md)。本页后续只补充它们在对象模型中的具体表现。

[返回 Knowledge Map](../../README.md)
