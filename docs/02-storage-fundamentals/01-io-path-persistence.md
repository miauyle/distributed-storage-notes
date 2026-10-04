# I/O Path / Persistence：Write Success 到底把数据送到了哪里

Application 看到写入成功，可能只是某层接收了字节。要判断故障后能否恢复，必须先明确：**哪个操作完成、哪些数据与 Metadata 达到什么持久化条件、承诺覆盖哪类故障？** 本篇建立单机前置，供对象提交、Replica ACK、Checkpoint 与 Direct I/O 复用。

## 1. 路径中的层次与完成点

典型 Kernel-managed 文件写入可以沿 Application Buffer → System Call / Runtime → Page Cache / Filesystem → Block Layer / Device Queue → Device Controller / Cache → Persistent Media 理解。它是逻辑模型，不是所有 OS / Filesystem 的固定实现；Direct I/O 可能绕过 Page Cache，缓存命中的读取也无需访问设备。

| 层次 | 保存或处理什么 | 该层的进展不自动意味着什么 |
| --- | --- | --- |
| Application Buffer | 应用或 Runtime 尚待提交的内容 | 已进入 Kernel；用户态缓冲函数返回不一定发出了系统调用 |
| Page Cache | Kernel 缓存的文件正文与 Dirty 状态 | 已写到 Device；进程退出与主机断电也不是同一故障 |
| Filesystem Metadata | 名称、大小、布局及恢复所需记录 | 与正文达到相同持久状态 |
| Block Layer / Device Queue | 下层请求、调度及在途工作 | Command 已完成或成功 |
| Device Controller / Cache | 设备接收的写入及内部缓存 / 映射 | Volatile Cache 已跨越断电边界 |
| Persistent Media | 相应字节已进入非易失保存状态 | 上层 Namespace、事务或对象恢复状态有效 |

Cache 可以改善复用和合批效率，也创造 **Accepted ≠ Persisted** 的窗口。Cache 不等于“不安全”；系统通过 Flush、Ordering 与明确的 Durability Contract 管理窗口。

## 2. Write Returned ≠ Durable

可用下面的检查链追踪持久化要求：**Application Submitted → Kernel Accepted → Device Command Completed → Required Cache Flushed → Durable according to selected failure model**。这是责任检查顺序，不要求所有实现都有五个独立事件；FUA 或受保护缓存可以改变所需动作。

| 观察到什么 | 尚需回答什么 |
| --- | --- |
| 提交函数返回 | 是否仅入队？若有用户态缓冲，是否已送入 Kernel？ |
| 普通文件 Write 返回 | 实际完成多少字节？后续 Write-back 是否仍可能失败？ |
| Device Command 完成 | 数据在 Volatile Cache 还是符合承诺的非易失层？ |
| 所需同步 / Flush 成功 | 数据、必要 Metadata 与设备行为是否满足所选故障模型？ |
| 本地持久化条件成立 | 上层状态是否有效？分布式 Protection / Metadata 发布是否完成？ |

Linux [write(2)](https://man7.org/linux/man-pages/man2/write.2.html) 明确区分返回的实际字节数与持久化：成功也可能短写，Write-back 错误可以后续报告。因此普通 Write 返回不自动意味着 Power-loss-safe Persistence。异步接口的 Submission 与 Completion 边界另见 [Direct / Async I/O](../09-data-path-performance/08-direct-async-io-device-path.md)。

“Durable”必须带故障范围：能承受应用进程崩溃，不代表能承受主机断电；能承受断电，不代表能承受设备永久丢失。后者需要额外保护，见 [Replication](../07-data-protection/01-replication.md)。

## 3. fsync / fdatasync：Linux API 契约实例

Linux [fsync(2)](https://man7.org/linux/man-pages/man2/fsync.2.html) 请求同步文件修改的正文及相关文件 Metadata，并等待设备报告完成；契约包括适用的设备缓存写出 / 刷新。`fdatasync` 同步正文及后续正确取回数据所必需的 Metadata，不要求同步所有无关属性，例如访问时间；文件大小变化则可能是必需 Metadata。

这不是“fdatasync 完全不写 Metadata”，也不是“fsync 自动持久化整个目录树”。文件的目录项有单独边界，手册指出保证包含该文件的目录项持久化还需要目录自身的同步。两种接口都可能失败，成功判断不能只检查此前 Write。

这是 Linux / Filesystem API 契约实例，不是所有存储系统的通用接口。实际保证依赖文件系统、下层设备和正确实现；本文不提供新建文件或 Rename 的通用调用配方。

## 4. Device Flush / FUA 与 Power-loss Behavior

Host 发出写操作后，Device 可能先把内容接收到内部 Volatile Write Cache，再报告普通 Command 完成。此时主机内存已经不是唯一易失位置。

| 概念 | 必要直觉 | 边界 |
| --- | --- | --- |
| Cache Flush | 要求相关先前写入离开易失缓存，达到协议定义的持久状态 | 范围、排序与错误语义取决于协议及路径；不是刷新 CPU Cache 的同义词 |
| FUA-like Semantics | 对指定写入，要求完成报告满足非易失保存条件 | 不自动为其他未关联写入提供全部顺序保证 |
| Power-loss Protection / Behavior | 设备或控制器如何在断电时保留已承诺状态 | 需要具体保证，不能从“SSD”或产品类别推断 |

[Linux Kernel Writeback Cache Control](https://docs.kernel.org/block/writeback_cache_control.html) 区分 Preflush 与 FUA：前者约束此前写入的刷新，后者约束本次写入的完成点。这里仅借它建立概念，不展开 SATA / NVMe 命令。Controller、Device 与 Driver 必须正确兑现契约；设备虚报完成或永久损坏不能靠 API 名称消除。

## 5. Data Persistence ≠ Metadata Persistence

**教学示意：**新文件的正文已持久，但引用它的目录项尚未达到要求；故障后可能找不到预期名称。另一类更新改变文件大小，即使底层部分字节存在，恢复时仍需要正确大小与布局才能解释。Rename 涉及 Namespace 更新，正文保存与名称变更也不能合成一个无条件保证。

这与对象存储的 **Data Ready ≠ Metadata Published** 相呼应，但二者不是同一协议。对象系统还要把 Identity、Version、Layout Reference 与保护条件组织成可恢复状态，见 [Read / Write Path](../03-object-storage/03-read-write-path.md) 和 [Metadata / Object Index](../08-consistency-metadata-partitioning/02-metadata-object-index.md)。设备保存了新正文，不能替它发布对象。

## 6. Ordering、Atomicity、Durability 分开判断

程序先调用写 A，再调用写 B，不自动保证故障恢复后出现期望的持久顺序。如果 B 是引用 A 的索引记录，而 A 尚未满足持久化要求，恢复时可能出现引用与内容不匹配。系统需要依据接口通过 Ordering、Flush 或 Transaction / Journal 等表达依赖；本文只建立需求，不展开日志文件系统。

**Atomicity ≠ Durability。** 原子可见性描述观察者是否看到一个不可分割的状态变化；Crash Atomicity 则讨论故障后是否只能恢复旧或新状态。二者都要注明范围，不能从“某一步原子”推出多步更新原子或已持久。

一个受上层协议保护的修改，可以向运行中的读者原子发布，却尚未跨过相应故障的持久边界。反过来，新正文的字节已经持久，也可能因 Metadata / Commit Record 未成立而不是有效的上层状态。**Device Command Completed ≠ Application Recovery State Valid。**

## 7. Torn / Partial State 与 Stable Storage 模型

大于底层原子保证范围的更新，在某些故障模型下可能留下新旧混合或部分状态。接口返回短写与故障后的 Torn Write 是两个问题：前者是已报告完成量，后者是恢复时的状态完整性。不能给一个固定 Sector 大小作为所有设备的原子保证；范围依设备、协议、配置与故障条件而定。

Checksum、Journal、Copy-on-write 与 Generation 等机制有理由存在：检测不完整 / 错配状态，或为恢复保留可判定依据。这里不展开机制，完整性回链 [Checksum / Data Integrity](../07-data-protection/04-checksum-data-integrity.md)。

“Stable Storage”通常是设计中的逻辑假设：已按约定保存的信息可以跨越规定故障。真实系统由 Device、Controller、Power-loss Behavior、Replication 与 Software Protocol 共同接近这个模型。**SSD ≠ Stable Storage**，也没有能承受任意故障的单个持久化调用。

## 8. 回到上层确认条件

判断一次 Write Success，应说明实际完成量、数据与 Metadata 范围、持久化 / 顺序契约、错误处理及故障模型。对象 PUT 还需满足发布条件，Replica ACK 还需说明每个副本确认到哪里，Checkpoint 还需形成应用可以恢复的完整状态；不能拿本地单个完成事件替代它们。

## 来源与适用边界

资料核对日期：**2026-10-03**。路径表、故障示例与上层连接为通用模型；Linux 行为按当前手册与 Kernel 文档核对，不能外推成所有系统的保证。

- [Linux man-pages：write(2)](https://man7.org/linux/man-pages/man2/write.2.html)：短写、延迟错误与返回边界。
- [Linux man-pages：fsync(2) / fdatasync](https://man7.org/linux/man-pages/man2/fsync.2.html)：同步范围、必要 Metadata 与目录项边界。
- [Linux Kernel：Writeback Cache Control](https://docs.kernel.org/block/writeback_cache_control.html)：Volatile Cache、Flush 与 FUA
