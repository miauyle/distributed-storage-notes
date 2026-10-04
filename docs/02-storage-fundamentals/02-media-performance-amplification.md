# Media / Performance / Amplification：相同字节为什么产生不同成本

[I/O Path / Persistence](01-io-path-persistence.md)明确了完成条件。本篇讨论另一条基础线：**请求大小、随机性、并发与介质如何改变实际工作量和等待？** 它提供单机成本直觉；端到端瓶颈、分布式排队和优化方法由 09 承接，不在这里重复。

## 1. 介质 / 设备类别与 Host Interface 分开

| 概念 | 主要描述什么 | 不应如何理解 |
| --- | --- | --- |
| HDD | 以旋转磁介质保存内容的设备类别 | 不规定应用接口、保护或共享语义 |
| SSD | 固态存储设备类别；本文讨论常见 NAND Flash SSD | 不等于一定使用 NVMe，也不保证任意请求成本相同 |
| NVMe | Host 与 Non-volatile Memory Device 通信的接口 / 协议体系 | 不是与 HDD / SSD 同级的第三种介质 |

**SSD ≠ NVMe。** NVMe SSD 是常见组合，也有使用其他接口的 SSD。不能把 HDD → SSD → NVMe 写成三个同级介质世代。[NVM Express Specifications](https://nvmexpress.org/specifications/)区分 Base、Command Set 与 Transport，说明协议还可以绑定不同传输；这里不展开协议版本或队列命令。

接口能力影响路径，但不能代替设备内部成本与上层工作负载。看到 NVMe 标签，仍需问请求大小、持久化条件、实际并发与介质状态。

## 2. HDD：定位与传输是不同成本

一次需要介质访问的 HDD 请求，可用 **Seek → Rotation → Transfer** 建立直觉：磁头定位到相应区域，等待目标位置旋转到可访问处，再传输字节。缓存命中、调度合并和设备布局可能改变实际工作；这不是固定时序或通用延迟公式。

Random Small I/O 更难连续利用已定位位置，每次少量有效字节仍可能承担定位成本。Sequential Large I/O 更容易连续传输并摊薄定位工作。因此同一设备的随机小请求与顺序大请求可能有明显成本差异，不能用一个峰值带宽描述两者。

应用的逻辑顺序也不必等于物理连续：文件碎片、其他并发请求和设备映射可能改变访问模式。本文不使用固定毫秒数或 IOPS 数作为所有 HDD 的保证。

## 3. SSD：没有机械 Seek，仍有内部工作

常见 NAND Flash SSD 没有 HDD 的机械定位成本，但存在 Page / Erase Granularity、Internal Mapping、Garbage Collection 与 Wear Management。写入与擦除粒度不同，不能把任意逻辑更新都当成原地修改同样数量的物理字节。

FTL（Flash Translation Layer）维护 **Logical Block Address → Physical Flash Location** 的映射。典型更新模型可理解为写入新位置、使旧页失效，再由后续设备内部 GC 整理仍有效的内容并回收可擦除区域。这里的 Flash GC 是必要的设备成本概念，与本轮未展开的对象生命周期或 Metadata Reference Cleanup 不是同一责任。

整理可能产生额外 Read / Program / Erase 工作，Wear Management 也影响布局选择。没有机械 Seek 不等于随机请求、连续请求和不同大小写入的成本都相同。映射、可用空间、历史写入及后台活动会改变表现；本文不展开固件算法。

[Micron 的 SSD Latency 分析](https://www.micron.com/about/blog/applications/data-center/why-latency-in-data-center-ssds-matters-and-how-micron-became-best-in-class)用于核对 GC 增加内部工作与尾部变化这一机制，不采用其产品跑分作为通用数字。

## 4. Latency / IOPS / Bandwidth：先统一统计集合

| 指标 | 含义 | 必须注明的边界 |
| --- | --- | --- |
| Latency | 一次请求从所选起点到终点的耗时 | 是否包括排队、缓存、Flush；是 Host 观察还是设备内部服务时间 |
| IOPS | 单位时间完成的 I/O 操作数 | 哪层操作，读写组成、成功或全部终止结果 |
| Bandwidth | 单位时间传输的字节数；这里指测量速率 | 有效应用字节、Host I/O 字节还是内部介质字节 |

同一观察窗口、同一完成集合，按实际完成字节统计时，可以用 **Bandwidth ≈ IOPS × Average Request Size** 建立量纲关系。Average Request Size 必须来自该集合，不是配置中的猜测值；单位也需一致。

它不是“提高 IOPS 就能无限提高带宽”的性能预测。Concurrency、Queue、Protocol Overhead、Device Limits 与 Workload Mix 会改变可实现的 IOPS 和请求组成。设备一次 I/O 也不等于对象 API 一次操作，因此 **Higher IOPS ≠ Higher Useful Application Throughput**。

## 5. Queue Depth：填补并行机会，也可能增加等待

Queue Depth 是所选边界内的 I/O 数量，工具可能只计等待项，也可能包含已发出未完成项。应用并发、Kernel 在途数和 Device Queue Depth 不是必然相等；请求可合并、拆分或命中 Cache。

在设备仍有并行余量时，更高深度可以补足工作，使多个内部执行单元得到利用。但 **Queue Depth ↑ ≠ Latency ↓**。超过合理服务能力后，更多请求主要积压在队列中，Tail Latency 增长；配置深度也不等于实际达到的深度。

这里不推导排队模型或建议统一参数。更完整的并发、饱和与统计关系见 [Latency / Throughput / Queueing](../09-data-path-performance/02-latency-throughput-queueing.md)。

## 6. Sequential / Random 不是两个足够的标签

| Workload 维度 | 为什么会改变成本 |
| --- | --- |
| Request Size | 决定固定工作摊到多少有效字节、需要处理多大内部单位 |
| Locality | 决定缓存复用、定位与内部映射行为 |
| Concurrency | 决定并行机会、争用及排队 |
| Read / Write Mix | 写入及后台整理可能影响读取，资源分配也不同 |
| Alignment | 请求边界与下层处理粒度不匹配时，可能增加额外工作 |

同样叫 Random，热区小范围读取与全地址空间随机写入不同；同样叫 Sequential，多个流交错与单流连续访问也不同。测试必须保留这些条件，不能只给“随机性能”一个无上下文数字。

## 7. Read / Write Amplification：先声明在哪层数什么

Application Bytes 是应用希望完成的逻辑字节，Internal Bytes 是选定 Storage Stack / Device 层实际处理的字节。Read / Write Amplification 描述完成逻辑操作引入的额外内部工作；常用字节比例为 **Internal Read Bytes / Logical Read Bytes** 与 **Internal Write Bytes / Logical Write Bytes**，但分子、分母和时间窗口必须明确。

| 来源 | 可能增加的内部工作 | 应区分什么 |
| --- | --- | --- |
| 小范围读取更大处理单元 | Over-read、校验或布局读取 | 返回给应用的字节与设备实际读取量 |
| Small Update / Read-modify-write | 为更新一部分先读旧内容，再写更大单位 | 写操作触发的内部读取不能无说明地除以应用读取量 |
| Metadata | 索引、布局或恢复记录的 I/O | 正文口径与包含 Metadata 的完整 Stack 口径 |
| EC | 编码写入、适用的小更新或降级读取工作 | 容量冗余比例不等于固定读 / 写放大率 |
| Compaction | 后台重新组织并写入已有内容 | 前台完成窗口与后台工作归属 |
| Flash GC | 迁移有效页、擦除和再次写入 | Host Writes 与内部 NAND Writes 的边界 |

**算术示意，非设备保证：**应用需要 8 KiB，某布局实际从设备取出 32 KiB，则这次以设备读取字节为分子的 Read Amplification 为 4。若应用写入 8 KiB 触发额外 Metadata 写入，应该按明确的完整字节口径计量，不能沿用这个读取比例。

不同层的比例不能简单相加或无条件相乘：缓存、合并、压缩、保护和后台窗口可能改变各层的操作集合。读写放大也不是 CPU、操作数、延迟或空间占用的同义词；不同成本需分别记录。布局与保护回看 [Object Layout](../03-object-storage/06-object-layout.md) 和 [EC](../07-data-protection/02-erasure-coding.md)。

## 8. Small / Large I/O：摊薄固定成本与扩大处理范围

Small Request 中 Request Setup、Metadata、Queue Entry、Syscall 或 Network Overhead 等固定成本占比更高；其中 Network 只在请求实际跨网络时存在，不是本地设备 I/O 的必经环节。

Large Request 更容易摊薄固定工作、提高有效带宽，但也可能占用资源更久、延迟后续小请求、增大 Retry Granularity 或读取应用不需要的范围。**Large I/O ≠ Always Better。** 是否合并请求应依据有效消费、延迟目标与内部处理粒度，不只看总传输字节。

单机平均延迟也不能说明全部用户体验。GC、Queue Burst、Background Work 与 Device Outlier 可能让少数请求等待很久。**Average Latency ≠ User-visible Tail Behavior**；分位数必须注明样本与窗口，更完整的尾部分析由 [09/02](../09-data-path-performance/02-latency-throughput-queueing.md) 承接。

## 9. Measurement Boundary：设备结果不能直接外推应用

| 测量边界 | 能回答什么 | 单独不能回答什么 |
| --- | --- | --- |
| Device | 指定设备入口下的 I/O 能力 | Filesystem、网络或对象提交成本 |
| Local Stack | 本地 API、缓存、文件系统与设备组合的表现 | 跨节点保护与远端 Metadata 协调 |
| Network | 指定传输路径的速率与等待 | 已持久化对象的有效吞吐 |
| Distributed Storage | 给定访问模型、保护与确认条件下的请求表现 | 应用解析、Batch 准备或状态消费成本 |
| Application | 最终有效完成或消费的表现 | 仅凭该指标定位每一层瓶颈 |

这些边界连接为 **Device → Local Stack → Network → Distributed Storage → Application** 的分析层次，不代表每个请求必经这条固定时序。Device Benchmark 只能支持对应设备 / 本地 I/O 问题，不能直接代表 Object Storage、Training Data Path 或 KV Cache 的端到端性能。进一步诊断见 [End-to-End Cost Model](../09-data-path-performance/01-end-to-end-cost-model.md) 与 [Benchmark / Bottleneck Analysis](../09-data-path-performance/03-benchmark-bottleneck-analysis.md)。

## 来源与适用边界

资料核对日期：**2026-10-03**。HDD 成本分解、请求对照和放大示例为通用工程模型，不提供固定厂商性能数字；SSD 讨论限定常见 NAND Flash 设备，不外推所有固态介质。

- [NVM Express：Specifications](https://nvmexpress.org/specifications/)：Host 协议、Command Set 与 Transport 的分类。
- [Micron：Choosing the right NAND](https://www.micron.com/products/storage/nand-flash/choosing-the-right-nand)：管理型 NAND 与 ECC / FTL 等管理职责的边界。
- [Micron：SSD Latency 分析](https://www.micron.com/about/blog/applications/data-center/why-latency-in-data-center-ssds-matters-and-how-micron-became-best-in-class)：GC 的内部工作与延迟变化，仅引用机制
