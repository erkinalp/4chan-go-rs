# Legacy Information of the 4chan Project

## 1. History and Context

### 1.1 Origins

4chan was launched in October 2003 as an anonymous imageboard inspired by Japanese imageboards, particularly Futaba Channel (2chan). The site was initially created as a place to discuss manga and anime, but quickly evolved to encompass a wide variety of topics across different "boards".

### 1.2 Technical Evolution

The codebase has evolved over almost two decades, largely maintaining its original architecture but with numerous additions and modifications:

- **2003-2005**: Initial version based on PHP and MySQL with basic imageboard functionalities
- **2006-2008**: Addition of new boards and features such as tripcode, captcha validation
- **2009-2012**: Implementation of JSON APIs, improved cache system
- **2013-2015**: Support for WebM, HTML5, partial refactoring of the system
- **2016-2022**: Incremental improvements, performance optimizations, and security patches
- **2023-2025**: Minimal maintenance without significant architectural changes

## 2. Legacy Architecture

### 2.1 Overview

The 4chan codebase is characterized by being a monolithic application written primarily in PHP, designed to prioritize efficiency and performance under high traffic conditions with limited resources. The architecture can be described as:

- **Monolithic**: All components are tightly coupled
- **Procedural**: Most of the code follows a procedural paradigm with some OOP inclusions
- **Hybrid MVC**: Basic separation between models (data), views (presentation), and controllers (logic), although not always respected

### 2.2 Main Components

The system is composed of the following key components:

#### 2.2.1 Configuration System
- Based on INI files processed by PHP
- Configuration by board, category, and global
- PHP constants system to define behaviors

#### 2.2.2 Database Engine
- Dual connection to MySQL (global and per board)
- Support for prepared queries in the PDO version
- Escaping functions and protection against SQL injections
- Basic transaction system with table locking

#### 2.2.3 Rendering System
- HTML generation through PHP functions
- Static HTML storage on disk for high performance
- Periodic reconstruction system for static pages
- Partial templates for UI components

#### 2.2.4 File Management System
- Exhaustive validation of uploaded files
- Automatic thumbnail generation
- Storage organized by board
- Support for multiple formats (images, WebM, PDF)

#### 2.2.5 Security Systems
- Captcha to prevent automated spam
- Pass system for premium users
- Connection and posting limitations
- HTMLPurifier for input sanitization
- Anti-flood and anti-spam systems

#### 2.2.6 Frontend
- CSS with multiple selectable themes
- Modular JavaScript with specific functionalities
- Basic interactivity system for replies
- Basic support for mobile devices

## 3. Technical Debt

The codebase accumulates considerable technical debt after more than 20 years of development:

### 3.1 Security Issues

- Use of obsolete PHP functions (mysql_* instead of complete PDO)
- Outdated dependencies with known vulnerabilities
- Inconsistent sanitization of user input
- Insecure storage of user data

### 3.2 Maintainability Issues

- Highly coupled code with rigid dependencies
- Minimal or non-existent documentation
- Scarce or absent automated tests
- Significant code duplication (test vs production files)

### 3.3 Scalability Issues

- Primarily vertical scaling design
- Difficulty in distributing components
- Dependency on shared file system
- Non-distributed sessions

### 3.4 Frontend Issues

- Non-semantic HTML with use of tables for layout
- CSS with limited compatibility with modern standards
- JavaScript without proper modularization or encapsulation
- Suboptimal mobile experience

## 4. Existing Documentation

The documentation of the original code is extremely limited:

### 4.1 Code Comments

- Scattered comments, mainly to explain workarounds
- Unresolved "FIXME" and "TODO" tags throughout the code
- Absence of API or interface documentation

### 4.2 Maintenance Documentation

- Absence of formal technical manuals
- No architectural or flow diagrams
- Institutional knowledge primarily transmitted verbally

### 4.3 Operations Documentation

- Manual procedures for most operational tasks
- Absence of automated runbooks
- Poorly documented infrastructure configuration

## 5. Legacy Infrastructure

### 5.1 Execution Environment

- Web servers with PHP 5.x/7.x
- MySQL 5.7 for data storage
- Memcached for caching
- Shared NFS file system for images

### 5.2 Deployment Architecture

- Multiple web servers behind load balancers
- Database servers with master-slave configuration
- CDN for serving static content
- Manual server configuration

### 5.3 Operational Processes

- Periodic database backups
- Manual log rotation
- Basic availability monitoring
- Manual vertical scaling processes

## 6. Historical Architectural Decisions

### 6.1 Performance Priority

The architecture was designed to maximize performance with limited resources:

- Static HTML generation to reduce server load
- Multi-level cache system
- Aggressive optimization of SQL queries
- Efficient storage of images and thumbnails

### 6.2 Operational Simplicity

Ease of operation was prioritized over flexibility:

- Minimal external dependencies
- Centralized configuration
- Predictable behavior under load
- Ability to function on modest hardware

### 6.3 Controlled Extensibility

The system allows extensions in specific areas:

- Plugin system for additional functionalities
- Configurable wordfilters by board
- Theme system for visual customization
- Per-board settings for specific behaviors

## 7. Lessons Learned

Throughout its history, the development of 4chan has provided valuable lessons:

### 7.1 Successes

- **Efficiency under high load**: Ability to handle millions of users with limited resources
- **Resistance to attacks**: System that has survived numerous attack attempts
- **Board flexibility**: Ability to host very different communities
- **Long-term stability**: Continuous operation for decades

### 7.2 Challenges

- **Legacy code maintenance**: Increasing difficulty in updating old components
- **Manual scaling**: Need for human intervention for scaling
- **Reactive security**: Primarily reactive approach to security issues
- **Technical limitations**: Inability to implement certain modern features

## 8. Institutional Knowledge

### 8.1 Undocumented Practices

There are numerous practices and knowledge that are not formally documented:

- Procedures for resolving specific problems
- Knowledge about specific behaviors under load
- Data migration practices between versions
- Techniques for diagnosing performance issues

### 8.2 Moderation System

Knowledge about moderation tools and processes is particularly valuable:

- Non-public administrative tools
- Incident response protocols
- Spam detection and mitigation systems
- Board-specific moderation policies and procedures

### 8.3 Specific Optimizations

Numerous ad-hoc optimizations have been implemented:

- Specific MySQL adjustments for the load pattern
- PHP optimizations to reduce memory usage
- Efficient image storage techniques
- Strategies for managing traffic spikes

## 9. Migration Considerations

When planning the system migration, several factors derived from its legacy state must be considered:

### 9.1 Knowledge Preservation

- Thoroughly document current behavior
- Interview veteran administrators and developers
- Capture business rules implicit in the code
- Create tests that validate expected behaviors

### 9.2 Backward Compatibility

- Maintain compatibility with existing links and references
- Preserve data formats for archived content
- Ensure that APIs maintain compatibility
- Consider migration of historical data

### 9.3 Community Expectations

- Recognize potential resistance to interface changes
- Preserve distinctive features valued by the community
- Maintain familiar user experience
- Clearly communicate improvements and changes

### 9.4 Ethical and Legal Considerations

- Review compliance with current regulations (GDPR, CCPA, etc.)
- Evaluate data retention policies
- Consider privacy implications in the new design
- Document decisions related to content moderation

## 10. Conclusion

The 4chan system represents a significant case study of a long-lasting codebase with an architecture optimized for its specific purpose. Despite its technical debt and limitations from a modern engineering perspective, it has demonstrated remarkable resilience and effectiveness in fulfilling its purpose over more than two decades.

The migration of this legacy system should be approached with deep respect for the original design decisions, many of which, although not following modern practices, were effective solutions for the specific constraints and requirements of their time.

---

This document serves as a starting point for understanding the historical, technical, and cultural context of the 4chan system before undertaking its modernization.
