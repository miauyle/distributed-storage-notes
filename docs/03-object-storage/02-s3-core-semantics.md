# S3 Core Semantics：操作如何改变对象状态

[对象模型](01-object-model.md)解释了“访问什么”。本篇解释“调用成功或失败后，能观察到什么”。HTTP 方法只是入口；真正需要理解的是原子性、可见性、条件判断和重试边界。

**适用范围：**本文的具体行为以当前 AWS 官方文档中的 **Amazon S3 general purpose bucket** 为准，默认 Bucket 从未开启 Versioning，已具备操作所需权限，且对象可直接读取。仅在明确标注处提及开启版本后的基本差异；directory bucket、其他扩展和 S3-compatible 产品需单独核对。示例不是 CLI 教程。

## 1. 用最小状态模型理解五个操作

设一个 Key 当前不存在，记为 `Absent`；当前可读内容为 A，记为 `Present(A)`。A / B 是示意内容标签，不是 Version ID。下表描述成功操作，条件是没有并发或后续修改：

| 操作 | 对象状态变化 | 返回或观察的内容 |
| --- | --- | --- |
| PUT A | `Absent → Present(A)`，或旧状态被 A 替换 | 写入成功及对象相关响应属性 |
| GET | 不改变对象内容状态 | 当前正文与响应元数据；Range 可限制返回字节 |
| HEAD | 不改变对象内容状态 | 对象相关响应头，不返回正文 |
| DELETE | `Present(A) → Absent` | 成功删除返回 `204`，不含对象正文 |
| LIST（ListObjectsV2） | 不改变对象内容状态 | Bucket 下匹配条件的 Key 与部分属性，不返回对象正文 |

这里“不改变状态”指对象内容的语义状态，不表示服务端没有日志、计量或其他内部活动。各操作详见 [PutObject](https://docs.aws.amazon.com/AmazonS3/latest/API/API_PutObject.html)、[GetObject](https://docs.aws.amazon.com/AmazonS3/latest/API/API_GetObject.html)、[HeadObject](https://docs.aws.amazon.com/AmazonS3/latest/API/API_HeadObject.html)、[DeleteObject](https://docs.aws.amazon.com/AmazonS3/latest/API/API_DeleteObject.html) 和 [ListObjectsV2](https://docs.aws.amazon.com/AmazonS3/latest/API/API_ListObjectsV2.html)。

## 2. PUT 的 overwrite 是完整状态替换

已有 `reports/monthly/2026-10/summary.json`，内容 A 为 `{"total":100}`。客户端 PUT 内容 B：`{"total":120}`。

AWS `PutObject` 成功意味着整个对象已被接收为对象状态，不会把仅上传了一部分的对象作为成功结果发布；这个接口也不是“只改 JSON 的一个字段”或“只更新一个元数据字段”的接口。参见 [PutObject](https://docs.aws.amazon.com/AmazonS3/latest/API/API_PutObject.html)。

对于与覆盖同时发生的 GET，AWS 保证单 Key 更新原子：读取返回旧内容或新内容，不会拼出一半 A、一半 B。这个保证描述的是对象状态，不能解读为网络断开时客户端仍必然收到完整响应体。参见 [AWS data consistency model](https://docs.aws.amazon.com/AmazonS3/latest/userguide/Welcome.html#ConsistencyModel)。

完整替换将对象的公开状态边界做得清楚，但有两项代价：小改动可能也需要传输完整正文；多个写者不能靠分别修改“不同字段”自动合并结果。应用应生成完整的新状态，并处理覆盖冲突。

### 强一致性承诺在哪里结束？

AWS S3 的新建、覆盖和删除具有强读后写一致性，HEAD 与对象 LIST 也遵循相应的一致性保证。在成功响应之后才发起的读取，应观察到这次更新或更新之后的状态。以下示例假设没有其他写者：

| 操作顺序 | 后续观察 |
| --- | --- |
| PUT B 成功，然后 GET 同 Key | 返回 B |
| PUT 新 Key 成功，然后 LIST 匹配 Prefix | 包含新 Key |
| DELETE 成功，然后 GET 同 Key | 不再返回已删除的正文 |
| DELETE 成功，然后 LIST 匹配 Prefix | 不再包含该 Key |

上述保证来自 [AWS data consistency model](https://docs.aws.amazon.com/AmazonS3/latest/userguide/Welcome.html#ConsistencyModel)。它没有把多个 Key 的更新组成一个原子事务，也没有把 Bucket 配置变更全部变成相同的对象级一致性契约。

若报告对象与一个独立索引对象分别写入，两者之间仍可能被读取到中间状态。AWS 的接口保证也不能直接推导客户端缓存或代理缓存已被刷新。工程上需要区分服务状态、应用协议与额外缓存层。

## 3. 两个写者同时覆盖，为什么还需要条件请求？

假设两个客户端都读到 A。客户端甲产生 B，客户端乙产生 C，然后都直接 PUT。两个请求可能都成功，但默认读取只得到系统最终确定的当前状态；强一致性不替应用合并 B 和 C，也不保证依据客户端本地的发起时刻决定最终结果。参见 [PutObject 的并发写入说明](https://docs.aws.amazon.com/AmazonS3/latest/API/API_PutObject.html)。

更稳妥的方式是让服务端将条件判断和本次写入作为一个受约束的操作处理，而不是先 HEAD、再无条件 PUT：

| 意图 | 条件 | 作用 |
| --- | --- | --- |
| 只创建尚不存在的 Key | `If-None-Match: *` | 防止覆盖已有当前对象 |
| 只替换我读到的状态 | `If-Match: <返回的 ETag>` | 写入时要求当前 ETag 与预期匹配 |

AWS 的条件不满足通常返回 `412 Precondition Failed`；并发冲突还可能出现 `409` 等错误，需要按对应 API 处理。参见 [AWS：Conditional writes](https://docs.aws.amazon.com/AmazonS3/latest/userguide/conditional-writes.html)。

条件判断解决的是“当前对象是否满足前提”，不是跨 Key 事务或永久的排他锁。应用收到 `412` 后应重新读取并决定如何合并或放弃，而不是删除条件盲目重试。

`If-Match` 比较的是 ETag，不是每次写入的唯一序号；ETag 不覆盖所有可能的业务状态变化，尤其不反映元数据变化，参见 [Object API 的 ETag 说明](https://docs.aws.amazon.com/AmazonS3/latest/API/API_Object.html)。若业务需要知道“中间有没有发生过任何写入”，不能仅凭 ETag 相等作结论。身份区别回看[Object Model](01-object-model.md)。

## 4. 超时后的 retry：未知结果不等于失败结果

**通用故障推导：**客户端没收到成功响应，至少有两种可能：请求没有完成；服务已经提交，但响应在网络中丢失。S3 的强一致性不能消除客户端在这个时间点的不确定性。

```text
T1：甲 PUT B，服务提交 B，但甲等待响应超时。
T2：乙 PUT C 成功，当前内容成为 C。
T3：甲无条件重试 PUT B，当前内容又成为 B。
```

这是符合覆盖语义的执行结果，不是“一致性失效”。问题在于重试变成一次新的写入，覆盖了乙的后续状态。

在没有其他写者、Versioning 从未开启且正文与属性相同的狭窄场景下，重复 PUT 可以使最终正文仍是 B。但这不等于请求恰好执行一次，也不保证响应、修改时间及所有外部影响完全相同。Versioning 开启时，重复写入还可能产生多个版本；参见 [PutObject](https://docs.aws.amazon.com/AmazonS3/latest/API/API_PutObject.html)。

对超时、连接中断和可能已执行的服务错误，应把结果视为需要判定的状态：

1. 区分确定的前提失败与不确定的提交结果；保留请求标识和预期内容。
2. 必要时 GET / HEAD 检查当前对象，再结合业务标识判断；ETag 不普遍等于正文 MD5，也不能证明哪一次请求提交。
3. 并发更新使用条件写或业务发布协议。重新读取后再决定是否重试，避免把新状态覆写回旧状态。

即使用 `If-None-Match: *`，超时后重试得到 `412`，也只能说明此时已有对象，不能直接证明它是第一次请求写入的。客户端仍要验证内容或业务身份。

## 5. GET / HEAD：观察状态，不是替下一步预约状态

GET 返回正文；HEAD 返回相应元数据而不传输正文，适合确认大小、验证值和其他属性。但 HEAD 并不承诺下一次 GET 一定看到相同状态，也不保证内部完全不接触数据存储。参见 [HeadObject](https://docs.aws.amazon.com/AmazonS3/latest/API/API_HeadObject.html)。

```text
HEAD → 观察到 A 的长度和 ETag
其他写者 PUT B 成功
GET  → 读取 B
```

这三个操作之间存在真实的更新。若客户端要将分段读取绑定到一份内容，应在支持版本寻址时指定同一个 `versionId`，或使用 `If-Match` 约束读取；后者约束 ETag，不能替代独立的版本身份。Range GET 只返回指定字节范围，并不扩大原子性到多个请求。参见 [GetObject](https://docs.aws.amazon.com/AmazonS3/latest/API/API_GetObject.html)。

**错误码也有信息边界。** AWS 对不存在对象的 GET / HEAD：拥有 `s3:ListBucket` 权限时返回 `404`；没有该权限时返回 `403`。因此 `403` 不能用来证明对象存在，`HEAD` 的失败也不能一律解释成“不存在”。参见 [GetObject](https://docs.aws.amazon.com/AmazonS3/latest/API/API_GetObject.html) 与 [HeadObject](https://docs.aws.amazon.com/AmazonS3/latest/API/API_HeadObject.html)。

## 6. DELETE 删除了哪一层状态？

在本文默认的未启用版本场景，成功 DELETE 使该 Key 不再具有可读取的当前对象。成功响应为 `204`；它描述对象接口结果，不说明每块底层介质在哪个时刻被擦除。参见 [DeleteObject](https://docs.aws.amazon.com/AmazonS3/latest/API/API_DeleteObject.html)。

对于实现，应区分“逻辑对象已不可见”和“物理空间已经可再分配”。这个区分用来理解 API 与内部布局的边界，本轮不展开空间回收机制。

**开启 Versioning 的基本例外：**不带 `versionId` 的 DELETE 会创建成为当前版本的 delete marker，而不等同于删除所有历史正文。这里仅指出默认读取状态与历史版本存在性的区别，不展开版本删除机制。参见 [DeleteObject](https://docs.aws.amazon.com/AmazonS3/latest/API/API_DeleteObject.html)。

删除重试也需要考虑并发：甲删除后超时，乙又在同 Key 创建新对象，甲随后无条件重复删除，可能删掉乙的新对象。即使重复删除在静态场景下能维持“当前不存在”，也不构成对并发重建的保护。

## 7. LIST 是命名空间查询，不是整桶数据快照

本文的 LIST 指 `ListObjectsV2`。它列出当前可见对象的 Key 与大小、ETag 等部分属性，不下载正文，也不列出所有历史版本或任意用户元数据。

对通用桶，结果按 Key 的字典序返回；`Prefix` 限定名字前缀，`Delimiter` 将部分名字分组为 `CommonPrefixes`。例如 Bucket 中有：

```text
monthly/2026-10/summary.json
monthly/2026-10/details.json
monthly/2026-11/summary.json
```

以 `Prefix=monthly/`、`Delimiter=/` 列举，可以得到 `monthly/2026-10/` 与 `monthly/2026-11/` 分组。它们是名字组织视图，不因此成为具有文件系统语义的目录。参见 [ListObjectsV2](https://docs.aws.amazon.com/AmazonS3/latest/API/API_ListObjectsV2.html)。

一次请求默认最多返回 1,000 项，实际结果可能更少。应检查 `IsTruncated` 并将 `NextContinuationToken` 原样用于下一页；这个 Token 是不透明分页标记，不是可以自行推导的 Key。参见 [ListObjectsV2](https://docs.aws.amazon.com/AmazonS3/latest/API/API_ListObjectsV2.html)。

**契约边界推导：**分页接口与单次 LIST 的强一致性，不能自行扩展成“整次多页遍历固定在同一个快照”。遍历期间如果应用还在增删对象，应按具体文档承诺设计处理方式；不要把 ContinuationToken 当成快照 ID。类似地，某 Key 被 LIST 返回后，后续 GET 前仍可能发生覆盖或删除。

这解释了为什么“先 LIST 得到清单，再逐个 GET”不天然成为批量事务。若业务需要固定数据集合，应明确集合成员与对象身份，并自行定义发布和消费边界；本轮不展开这一协议。

## 阅读衔接与来源

现在可以区分三件事：操作是否返回、服务是否提交，以及后续请求观察到哪个对象状态。下一篇追踪系统需要完成哪些工作才能兑现这些承诺：[Read / Write Path](03-read-write-path.md)。一致性与索引的深入内容见[08 专题（目前为骨架）](../08-consistency-metadata-partitioning/README.md)。

AWS 来源核对日期：**2026-10-02**。具体接口行为链接已放在对应结论旁；超时并发时间线与分页边界分析是基于这些契约的工程推导。
