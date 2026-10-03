# Distributed Storage Notes

长期维护的 **Distributed Storage 技术知识库**，系统整理分布式存储的通用架构、机制与工程实践，重点深入 **Object Storage**，并逐步连接 AI Storage 与高性能数据路径。

本仓库不作为 Dell ECS / ObjectScale 项目复盘、AI Storage 面试教程或面试速记；产品案例只使用公开资料，不记录内部实现细节。

**Core Knowledge Mainline Complete / Maintenance Mode。** 主体知识主线已完成，仓库进入 Maintenance / Targeted Expansion 阶段。Block / File 保持访问模型边界与类型入口，不代表已完成完整深入专题；规划项也不代表已有正文。

## Core Foundations

- [Storage Architecture](docs/01-overview/README.md)：访问模型、逻辑职责与架构目标。
- [Storage Fundamentals](docs/02-storage-fundamentals/README.md)：I/O、持久化边界与介质成本。
- [Distributed Systems](docs/06-distributed-systems/README.md)：故障观察、修改资格与重试基础。

## Object Storage Mainline

- [Object Semantics](docs/03-object-storage/README.md)：对象身份、API、读写提交、上传、版本与布局。
- [Protection](docs/07-data-protection/README.md) / [Metadata](docs/08-consistency-metadata-partitioning/README.md) / [Recovery](docs/10-recovery-operations-observability/README.md)：冗余、完整性、状态、归属与恢复。
- [Performance](docs/09-data-path-performance/README.md) / [Operations](docs/10-recovery-operations-observability/README.md)：路径成本、运行余量、观测、灾难恢复、演练与排障。

## Applied Systems

- [Typical Storage Systems](docs/11-typical-storage-systems/README.md)：Ceph RGW / MinIO / Swift 的公开架构比较。
- [AI Storage Connections](docs/12-ai-storage-connections/README.md)：Training State、GPU Data Path 与 KV Cache 基础连接。

## Knowledge Map

从 Block / File / Object 三类访问模型进入，再了解共用的分布式机制，接着考察故障、性能与运维，最终连接 AI 工作负载。图中的箭头表示阅读方向，不表示严格的技术依赖；复制、元数据和数据路径在实际系统中相互影响。

```mermaid
flowchart TD
    DS["Distributed Storage"]
    DS --> B["Block Storage"]
    DS --> F["File Storage"]
    DS --> O["Object Storage · 重点"]
    B --> D["Distributed Systems"]
    F --> D
    O --> D
    D --> P["Replication / Erasure Coding"]
    D --> M["Consistency / Metadata / Partitioning"]
    P --> R["Failure Recovery"]
    M --> R
    P --> DP["Data Path & Performance"]
    M --> DP
    R --> OP["Operations / Observability"]
    DP --> OP
    OP --> AI["AI Storage Connections"]
```

## 知识目录

| 目录 | 页面定位 | 内容边界 |
| --- | --- | --- |
| [01 · Overview / Storage Architecture](docs/01-overview/README.md) | 全景与架构入口 | 访问模型、逻辑职责、Control / Metadata / Data Path |
| [02 · Storage Fundamentals](docs/02-storage-fundamentals/README.md) | 单机存储与 I/O 基础 | 介质、持久化、缓存、性能指标 |
| [03 · Object Storage](docs/03-object-storage/README.md) | **重点主线，后续深度与篇幅高于 Block / File** | 对象模型、S3 语义、读写链路、布局、版本与生命周期 |
| [04 · Block Storage](docs/04-block-storage/README.md) | 块访问模型与边界 | 卷、块寻址、快照、与上层文件系统的关系 |
| [05 · File Storage](docs/05-file-storage/README.md) | 文件访问模型与边界 | 命名空间、目录、文件共享与缓存语义 |
| [06 · Distributed Systems](docs/06-distributed-systems/README.md) | 分布式协调与系统假设 | 故障模型、共识、成员管理、幂等与重试 |
| [07 · Replication / Erasure Coding / Data Protection](docs/07-data-protection/README.md) | 冗余与数据保护 | 副本、纠删码、故障域、跨区域保护 |
| [08 · Consistency / Metadata / Partitioning](docs/08-consistency-metadata-partitioning/README.md) | 语义、索引与数据归属 | 一致性、元数据、分片、放置与热点 |
| [09 · Data Path / Performance](docs/09-data-path-performance/README.md) | 请求经过的路径与成本 | I/O、网络、缓存、瓶颈、基准测试 |
| [10 · Failure Recovery / Operations / Observability](docs/10-recovery-operations-observability/README.md) | 故障后的恢复与持续运行 | 检测、修复、迁移、容量、监控与排障 |
| [11 · Typical Storage Systems](docs/11-typical-storage-systems/README.md) | 用公开系统检验通用模型 | 对象、块、文件系统的统一维度对照 |
| [12 · AI Storage Connections](docs/12-ai-storage-connections/README.md) | 连接训练与推理的数据需求 | Workload / Training State、GPU Data Path、Inference State / KV Cache 基础主线完成 |

## 划分原则与扩展方式

- **访问模型与共用机制分开。** Block / File / Object 解释用户看到的接口与语义；复制、一致性、元数据等机制集中维护，避免在三种存储下重复写教程。
- **机制与恢复过程分开。** 数据保护回答“如何冗余、能承受什么故障”，故障恢复回答“故障发生后如何检测、修复并恢复服务”。
- **对象存储作为主线。** 优先补齐对象语义和完整读写链路，再连接共用机制；Block / File 的统一对照由 01 覆盖，04 / 05 保持类型入口，按实际需要深入。
- **案例与 AI 连接建立在基础之上。** 典型系统用于验证通用概念；AI 专题讨论工作负载如何改变存储需求，并回链基础章节。
- 每个目录由 `README.md` 维护定位与阅读入口。确有独立内容时再增加语义化命名的 Markdown 文件，并更新所属入口链接；本阶段不预建大量空文章或多层目录。
- 后续正文统一用中文解释并保留常用英文术语，结合问题、数据路径、取舍与故障场景；系统特定结论标注公开来源、版本或适用条件。待展开项只表示规划，不表示已完成。

## 维护期原则

1. 维护 Correctness 与 Source Freshness，核对具体接口和产品事实的适用条件。
2. 修复失效链接、过期版本事实与导航问题。
3. 仅在出现明确知识缺口时做 Targeted Expansion，不为增加篇数扩展主题。
4. Block / File 与真实产品案例只按具体需求扩展；规划列表不构成必须新增正文的清单。

主体知识主线建设已收口。后续不预设必须新建的文章；独立 Postmortem、完整分布式理论或更多 AI 主题均按实际需要判断。
