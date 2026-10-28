# Project Supervisor

**Product Blueprint & Engineering Requirements**

- **Version:** 0.1.0
- **Status:** Foundation / Private Alpha
- **Development model:** Open-source, free-first, personal-first
- **Primary audience:** New website owners, independent developers, students, freelancers, small teams and organizations
- **Project Zero:** Project Supervisor manages and monitors itself before onboarding external projects

---

## 1. Mission

Build an intelligent, reliable, secure, privacy-first, and accessible AI-powered website operations platform.

Project Supervisor is designed to act as a technical assistant that can observe, investigate, explain, test, propose, and—when authorized—execute engineering operations.

Its purpose is not to replicate general-purpose AI chatbots. It must connect to real project environments, collect verifiable evidence, maintain operational context, and produce measurable results.

The platform prioritizes individuals and newly established websites that lack dedicated DevOps, SRE, or security personnel.

## 2. Non-negotiable Principles

1. **Privacy by design:** Customer information remains private and under the customer's control.
2. **Security by default:** Connections begin with the minimum necessary privileges.
3. **Trust-based automation:** Users determine how much responsibility they delegate.
4. **Personal-first:** Deliver a genuinely useful single-user product before public expansion.
5. **Free-first:** Optimize legitimate free tiers without relying on abuse or circumvention.
6. **Open source:** Release the software under an appropriate open-source license, to be selected before publication.
7. **Bring your own AI:** Users may configure supported AI providers, models, and credentials.
8. **Provider independence:** Avoid unnecessary dependence on one model, hosting provider, or database.
9. **Evidence over claims:** Every diagnosis and action must be supported by actual data.
10. **No silent production changes:** Privileged actions must follow explicit authorization policies.
11. **Recoverability:** Design for detection, rollback, incident response, and recovery.
12. **Usability:** Serve beginners without restricting advanced users.

Zero defects, zero security risk, unlimited free computing, and 100% availability cannot be guaranteed. Release decisions must instead rely on measurable tests, risk controls, and verified operational outcomes.

## 3. Target Users and Deployment Models

### 3.1 Personal Workspace

Each user has an isolated environment containing:

- Personal preferences and technical proficiency level
- Projects and authorized resources
- Project-specific memory
- Tasks and execution histories
- Incident records and runbooks
- AI provider and model configuration
- Usage, quota, and spending controls
- Privacy and access policies
- Notification settings
- Data export and deletion controls

### 3.2 Hosted Community Edition

Provide a free hosted experience with clearly communicated resource limits, abuse protections, and privacy policies.

Expensive AI workloads must not be subsidized indefinitely by a single administrator-owned API key.

### 3.3 Private Self-Hosted Edition

Allow individuals and organizations to deploy the same open-source application on their own infrastructure.

They must be able to manage their own data, encryption keys, AI providers, and network access.

A self-hosted deployment must not contain a hidden administrative backdoor or require permanent operator access.

### 3.4 AI-Optional Operation

The platform must remain useful without a connected language model through deterministic health checks, deployment monitoring, alerts, basic diagnostics, and automation rules.

Advanced AI functionality is an optional enhancement, not a prerequisite for basic reliability.

## 4. Trust-Based Integration

Supported trust levels:

### Level 1 — Public Monitoring

- Public HTTP and HTTPS availability
- Response time and status codes
- Public TLS certificate status
- Basic public endpoint health checks
- No repository, SSH, database, or hosting credentials required

### Level 2 — Authorized Diagnostics

- Read selected repositories
- Read explicitly authorized deployment metadata
- Inspect permitted technical logs
- Collect relevant error evidence
- No write access by default

### Level 3 — Assisted Engineering

- Analyze source code within granted scope
- Prepare code changes
- Run tests in isolated environments
- Create branches and Pull Requests
- Require approval before merging or production deployment

### Level 4 — Managed Operations

- Perform explicitly authorized maintenance workflows
- Use narrow, time-limited permissions where supported
- Enforce policy-based approval for sensitive operations
- Support emergency stop and immediate authorization revocation
- Record auditable actions and outcomes

Trust levels must not automatically grant all possible permissions. Users must be able to configure individual capabilities.

A less privileged account must receive a useful product experience without being pressured to grant excessive access.

## 5. Supported Integrations

### Initial Integrations

- GitHub repositories, commits, pull requests and workflows
- Netlify deployments, build statuses and authorized project metadata
- Public website health monitoring

### Planned Integration Adapters

- Vercel
- Cloudflare Pages and Workers
- GitLab and other source repositories
- WordPress
- Docker-based applications
- VPS and self-managed servers
- Other services through documented plugin interfaces

Each connector must provide:

- Documented authentication method
- Minimum required permissions
- Explicit resource selection
- Permission verification
- Rate-limit handling
- Retry and timeout strategy
- Error reporting
- Disconnection and credential revocation
- Data minimization
- Independent tests

Use official APIs and delegated authentication whenever practical. Do not request a user's primary account password when a safer integration mechanism exists.

## 6. Multi-Tenant Security and Isolation

The hosted platform must isolate users and organizations across all data and execution paths.

Isolation applies to:

- Database records
- Object storage
- Logs and traces
- Cached responses
- Background jobs and queues
- AI memory and retrieval results
- Project connections and secrets
- Notifications
- Backups
- Tool execution contexts

Required protections:

- Strong authentication
- Server-side authorization on every protected request
- Object-level and tenant-level access checks
- Least-privilege service accounts
- Encryption in transit and at rest
- Secure secret storage and key rotation
- Protection against cross-tenant data access
- Secure session management
- Rate limiting and abuse prevention
- Audit trails without exposing credentials
- Independent access-control testing

Application administrators must not receive unrestricted access to customer secrets by default.

Sensitive support access, if implemented, must be explicitly authorized, scoped, time-limited, and audited.

## 7. Customer Data Protection

Customer data belongs to its owner.

The platform must not:

- Publish private repositories or server information
- Expose credentials through frontend bundles or public APIs
- Include customer secrets in public bug reports
- Upload unapproved private data to external AI providers
- Use customer content to train platform-owned AI models without explicit consent
- Access unrelated services or resources
- Continue privileged operations after authorization is revoked

Required capabilities:

- Transparent data handling and retention policies
- User-controlled connection management
- Data export
- Account and project deletion
- Defined backup retention and deletion lifecycle
- Privacy-aware logging
- Secret redaction
- Safe incident reporting
- Visible access and execution history

Secrets must never be committed to public repositories.

## 8. AI Privacy and Provider Independence

Users may configure:

- Available free-tier AI providers
- Paid AI APIs under their own accounts
- Supported local or self-hosted models
- Custom compatible AI endpoints
- Per-task AI model preferences
- Reasoning effort where supported
- Usage ceilings and fallback policies

AI provider configuration must remain separate for each user.

API credentials must be stored securely on the server or in a user-controlled trusted environment. They must not be exposed in client-side code or ordinary logs.

The system must explain relevant third-party data processing policies before transferring private content.

External AI processing of private repositories, logs, or infrastructure information must require an explicit policy allowing the specific provider and data scope.

A model fallback must not silently transfer information to another provider.

AI-generated instructions, repository content, logs, and retrieved documents are untrusted input, not authorization to execute privileged actions.

## 9. Intelligent Operations Engine

The operations engine must support:

- Natural-language task requests
- Task classification and prioritization
- Multi-step planning
- Tool selection
- Tool-call authorization
- Evidence collection
- Context retrieval
- Execution state persistence
- Retries and timeouts
- Human approval checkpoints
- Verification of results
- Incident summaries
- Reusable runbooks

The engine must distinguish between:

- Observed facts
- Hypotheses
- Proposed actions
- Approved actions
- Executed actions
- Verified results
- Failed or incomplete actions

It must not describe an unexecuted recommendation as a completed repair.

## 10. Evidence-Based Engineering

For every code-related diagnosis, collect available supporting evidence such as:

- Repository name and selected commit
- File path and line references
- Relevant Git diff
- Error logs and stack traces
- Deployment metadata
- Test results
- Environment and framework details
- Before-and-after changes

Line references must correspond to the actual file version, not invented examples.

Preferred engineering workflow:

1. Detect or receive a problem.
2. Determine authorized scope.
3. Collect relevant evidence.
4. Form and evaluate hypotheses.
5. Prepare a minimal change.
6. Run static analysis and tests.
7. Present the proposed change and risk.
8. Obtain required approval.
9. Create a Pull Request or execute an authorized action.
10. Verify actual results.
11. Update project memory and incident history.

## 11. Monitoring and Incident Management

Core observability capabilities:

- Website availability monitoring
- HTTP status and latency trends
- Deployment status and failure detection
- Authorized error log analysis
- Scheduled checks
- Incident classification
- Duplicate alert suppression
- Incident timelines
- Notifications
- Recovery tracking
- Post-incident reports

Prefer lightweight deterministic checks before AI inference.

Do not assume a successful health-check response proves the entire system is healthy.

## 12. Independent Guardian

Guardian is a separate watchdog and recovery-assistance subsystem.

Its responsibilities include:

- Checking Supervisor availability independently
- Detecting selected critical failures
- Sending alerts through an independent channel
- Preserving minimal recovery metadata
- Supporting emergency suspension
- Monitoring backup status
- Helping initiate approved recovery workflows
- Verifying restoration through tests

Guardian must not depend completely on the main Supervisor application, its primary database, or its normal alert-delivery path.

Guardian must not become an unrestricted hidden entry point into customers' servers.

## 13. Backup, Recovery, and Continuity

Required controls:

- Versioned source-code history
- Encrypted database and configuration backups
- Offsite backup copies where appropriate
- Independent recovery credentials
- Documented recovery procedures
- Regular restoration tests
- Rollback checkpoints
- Secrets rotation procedures
- Recovery objectives defined for each service
- Emergency kill switch

A backup is not considered verified until restoration has been successfully tested.

Do not store customer secrets in plaintext backup archives.

## 14. Free-Tier Optimization

Use legitimate free resources efficiently.

Initial architecture candidates may include:

- Netlify for the frontend and selected serverless functions
- Cloudflare Workers for lightweight independent operations
- Cloudflare D1 or another suitable database
- GitHub Actions for authorized CI tasks
- Playwright for browser-based tests
- Open-source static analysis and security tools
- Supported AI APIs with available free quotas

Provider choices are implementation decisions, not permanent requirements.

Actual free-tier limits, platform capabilities, commercial terms, and acceptable-use policies must be checked before adoption.

Optimization techniques:

- Event-driven processing where possible
- Conditional polling
- Caching with tenant isolation
- Rate-limit-aware scheduling
- Small context windows based on relevant evidence
- Diff-based code inspection
- Deterministic diagnostics
- Task queues
- Request deduplication
- Per-user quotas
- Spending and usage alerts
- Graceful degradation when providers are unavailable

Do not attempt to bypass quotas, billing systems, or provider restrictions.

## 15. Security Engineering

Required defenses include:

- Cross-site scripting prevention
- Cross-site request forgery protection where applicable
- Server-side request forgery prevention
- Injection prevention
- Secure URL validation and network egress controls
- Webhook signature verification
- Dependency and secret scanning
- Secure error handling
- Safe file upload and parsing
- Protection against prompt injection
- Restricted execution of untrusted code
- Access-control testing
- Secure credential lifecycle management

Never run arbitrary customer code with unrestricted production credentials or access to another tenant's environment.

Use sandboxing and separated identities for automated engineering tasks.

## 16. Privacy and Permissions Center

Users must be able to understand:

- Which services are connected
- Which resources are accessible
- Which permissions have been granted
- Which actions require approval
- Which AI provider receives permitted data
- Which tasks are active
- How much AI and cloud usage has been consumed
- How to revoke access
- How to export or delete data

Important permissions must be understandable to beginners.

Consent must be specific and revocable. Consent for monitoring does not imply consent for code modification or production access.

## 17. Product Experience and Accessibility

The interface must be:

- Clean and professionally designed
- Responsive for desktop, tablet and mobile
- Fast and lightweight
- Accessible by keyboard and assistive technologies
- Clear about errors and incomplete operations
- Available in Vietnamese and English when implemented
- Friendly to beginners without hiding advanced controls
- Focused on real operational outcomes

The dashboard must show real application data rather than fabricated monitoring results.

The interface should prioritize:

- Project health
- Current incidents
- Pending approvals
- Recent deployments
- Running and completed tasks
- Usage and quota visibility
- Security and privacy controls

Avoid unnecessary visual complexity.

## 18. Engineering Quality

Development requirements:

- Modular, maintainable architecture
- Typed interfaces where practical
- Documented APIs
- Input validation
- Automated tests
- Integration tests
- Security regression tests
- CI quality gates
- Reproducible deployments
- Staging and production separation
- Code review through Pull Requests
- Dependency version management
- Clear rollback procedures

A completed feature must include appropriate evidence of correctness.

Do not merge changes solely because an AI model claims they are safe.

## 19. Project Zero and Development Safety

The first managed project is Project Supervisor itself.

Initial repository:

`crissh52/my-ai-chatbot`

Development branches:

- `main` — Existing production code
- `backup/legacy-chatbot` — Preserved legacy baseline
- `feature/supervisor-v01` — Isolated development

The existing chatbot must remain available until a tested replacement is ready.

The original source backup does not replace backups of Git history, cloud configuration, environment variables, or user data.

Do not expose production credentials in untrusted preview environments.

## 20. Release Milestones

### M1 — Secure Foundation

- Preserve legacy application
- Create development branch and architecture documentation
- Establish security baselines
- Add tested health checks
- Configure safe staging and CI

### M2 — Personal Supervisor

- Single-user authentication
- Project registry
- Secure GitHub and Netlify integrations
- Real project status display
- Task persistence
- Basic monitoring

### M3 — Intelligent Operations

- Pluggable AI router
- BYOK and privacy preferences
- Evidence-based diagnostics
- Project memory
- Incident history
- Assisted code changes and testing

### M4 — Guardian and Recovery

- Independent watchdog
- Notification pipeline
- Backup lifecycle
- Restore tests
- Failure simulations

### M5 — Multi-Tenant Security

- Tenant-aware authorization
- Database and task isolation
- Per-user secrets and quotas
- Privacy and permission center
- Revocation workflows
- Security test suite

### M6 — Community Release

- Public onboarding
- Documentation
- Self-host installation guide
- Open-source license
- Responsible vulnerability disclosure process
- Public release after security review

## 21. Mandatory Release Gates

Before public onboarding:

- Authentication and authorization tests pass.
- Cross-tenant isolation tests pass.
- Secrets are absent from public bundles and logs.
- Privileged operations require appropriate permission.
- User revocation workflows are verified.
- Sensitive AI data transfers follow consent policy.
- Basic abuse protection is enabled.
- Backups and restoration are tested.
- Critical known security issues are resolved.
- The privacy policy accurately reflects real processing.
- Monitoring and incident response procedures exist.
- Production rollback procedures are verified.

If a critical gate fails, postpone release.

## 22. Project Success Criteria

Success is measured by real outcomes:

- A beginner can connect a website without unnecessarily granting privileged access.
- Supervisor can detect and explain a real deployment failure using actual evidence.
- An authorized user can receive a tested code-fix proposal.
- Customer information remains isolated during verified security testing.
- Users can choose their own AI provider or disable external AI.
- Guardian can detect failure of the main application independently.
- Backup restoration succeeds in a controlled test.
- The software is useful before any public growth.
- The final project is reproducible, documented, and suitable for technical portfolio review.

---

**Engineering motto:**

*Build trust through verifiable security, useful automation, transparent permissions, and reliable execution — not through exaggerated promises.*
