# 文档

当前文档按用途分层：

- [setup.md](setup.md): 本地开发、Supabase 初始化、首次管理员、Vercel、Docker 和故障排查。
- [ai-mcp-access.md](ai-mcp-access.md): AI/MCP 操作博客的功能说明、OAuth 接入、客户端配置、安全行为和故障排查。
- [architecture.md](architecture.md): 当前代码结构、路由、数据模型、安全边界、部署模型和已知限制。
- [release-checklist.md](release-checklist.md): 发布门禁和部署后 smoke test。
- [project-audit.md](project-audit.md): 历史审计记录。
- [project-plan.md](project-plan.md): 历史问题整合和修复计划。

## 维护规则

- README 只保留项目概览、快速开始、部署入口和核心链接。
- setup 文档只写可执行步骤，不记录长期规划。
- architecture 文档必须和当前代码保持一致；功能、路由、数据、安全或部署行为变更时同步更新。
- release-checklist 记录发布门禁和 smoke test 预期。
- 历史 audit 文档不作为当前状态来源，除非重新审计后更新。
