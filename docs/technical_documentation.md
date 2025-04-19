# 4chan Technical Documentation

## 1. Introduction

This document provides detailed technical documentation for the 4chan project, an anonymous imageboard launched in 2003. The documentation aims to facilitate the phased migration of the system, following the recommendations of the forensic analysis and modernization proposal presented in the "soyspeedygonzales.md" document.

### 1.1 Purpose

The purpose of this document is to:
- Provide a deep technical understanding of the current architecture
- Identify key components and their interrelationships
- Establish a roadmap for gradual migration
- Document design patterns and architectural decisions

### 1.2 Scope

This documentation covers all main components of the 4chan system, including:
- General architecture and directory structure
- Database and storage systems
- Frontend and backend components
- Security and authentication mechanisms
- Cache and optimization systems

## 2. General Architecture

### 2.1 Overview

4chan uses a traditional monolithic PHP application architecture, with partial separation into components and a basic MVC pattern. The system is designed to handle high traffic with low resource consumption, using a centralized database approach with optimizations such as memcached.

### 2.2 Main Technologies

- **Backend**: PHP (older versions)
- **Database**: MySQL
- **Frontend**: HTML/CSS/JavaScript
- **Cache**: Memcached
- **Web server**: Not explicitly specified, presumably Apache or Nginx

### 2.3 Directory Structure

- **/config/**: Configurations in .ini files
  - **/boards/**: Configuration by board
  - **/categories/**: Configuration by category
- **/lib/**: Libraries and main functionalities
- **/views/**: View templates
- **/css/**: Styles and themes
- **/js/**: JavaScript
- **/plugins/**: Plugin system
- **/wordfilters/**: Word filters
- **/modes/**: Operation modes
- **/forms/**: Forms

### 2.4 Main Components

- **Configuration system**: Based on INI (yotsuba_config.php)
- **Rendering engine**: For threads and images (imgboard.php)
- **Captcha system**: (captcha.php)
- **Posting system**: Post management (imgboard.php)
- **Administration**: (admin.php, admin-test.php)
- **JSON API**: (json.php)
- **Catalog system**: (catalog.php)
- **Authentication**: (auth.php)
- **Pass system**: (signin.php)

## 3. Database System

### 3.1 Structure

4chan uses MySQL with two connection implementations:
- **db.php**: Older implementation with mysql_* functions (now deprecated)
- **db_pdo.php**: More modern implementation with PDO

The system maintains two connection contexts:
- **Global**: For configuration, users, and shared data
- **Per board**: Each board has its own tables with the same structure

### 3.2 Data Access Patterns

- **Dual connection**: Handling two separate connections:
  - `$gcon` for global queries (authentication, configuration)
  - `$con` for board-specific queries
- **Connection retries**: System to manage connection errors
- **Prepared statements**: In the PDO version to mitigate SQLi
- **Automatic escaping**: With helper functions
- **Transactions**: Table lock/unlock system
- **Query logging**: Capability to log and time SQL queries

### 3.3 Main Tables

Not fully specified in the analyzed code, but the following tables can be inferred:
- **Board tables** (like `b`, `pol`, etc.): Store posts
- **boardlist**: Mapping of board directories to names and databases
- **PASS_USERS**: Users with passes

## 4. Frontend

### 4.1 Frontend Structure Organization

The 4chan frontend is structured following a modular approach with clear separation between CSS, JavaScript, and PHP templates:

#### Directory Structure
- **/css/**: Contains all style files (visual themes)
- **/js/**: Contains JavaScript scripts for interactivity
- **/views/**: Contains PHP templates for HTML generation
- **/imgtop/**: Contains resources for the top parts of the site

#### Generation System
- The system uses PHP to render pages server-side
- Main files like `imgboard.php` contain rendering functions
- Generated views are stored as static HTML files

### 4.2 Themes and Display System

4chan offers multiple visual themes that can be selected by the user:

#### Main Themes
- **Yotsuba**: Light theme with yellow tones
- **Yotsuba B**: Blue variant of Yotsuba
- **Futaba**: Classic pink/reddish theme
- **Burichan**: Theme in blue tones
- **Tomorrow**: Modern dark theme
- **Photon**: Minimalist light theme

#### Display Variants
- Mobile versions
- Catalog versions
- Support for temporary special themes or events

### 4.3 JavaScript

The frontend system uses very few external dependencies, opting for custom code:

#### Main Scripts
- **core.js**: Core functionality and basic utilities
- **catalog.js**: Specific handling of catalog view
- **extension.js**: Extended and optional functionalities
- **tcaptcha.js**: Custom implementation of the CAPTCHA system

#### Dynamic Functionalities
- **Tooltip System**: Implemented in `Tip` in core.js
- **Content filters**: Allows filtering threads in real-time
- **Quick Reply**: System for quick responses
- **Thread Watcher**: For following specific threads
- **Oekaki** (drawing): System for drawing images

## 5. Design Patterns and Control Structures

### 5.1 Rendering Patterns and HTML Generation

- **Partial View Pattern**: Files in `/views/` contain interface rendering logic
- **Function-based Rendering**: Specific functions for each content type
- **Template Injection**: Generated content is injected into variables (`$dat`)
- **Page Composition**: Rendering is divided into parts that are combined
- **Conditional Generation**: Use of conditions to determine what to render
- **HTML Cache**: Generation of static HTML files to improve performance

### 5.2 File/Image Management System

- **Extensive Validation**: Verification of type, size, dimensions, and content
- **Format Detection**: Header analysis to verify MIME types
- **Thumbnail System**: Automatic generation of reduced versions
- **Specialized Processing**: Differentiated handling according to file type
- **Oekaki (Drawing)**: Integrated drawing system
- **Structured Storage**: Organization based on boards
- **Scheduled Deletion**: System to delete old or reported files

### 5.3 Security and Authentication Patterns

- **Pass System**: Premium authentication mechanism
- **Attempt Limitation**: Control of failed attempts
- **Session Timeouts**: Automatic session expiration
- **CAPTCHA**: Integrated system to prevent spam
- **Level-based Permissions**: Different access levels
- **Capability Flags**: System to enable specific functions
- **IP Verification**: IP validation and tracking
- **HTML Purification**: Use of HTMLPurifier to sanitize input
- **Country Detection**: Integration with GeoIP

### 5.4 Cache Mechanisms

- **Data Cache**: In-memory storage of frequent information
- **HTML Cache**: Generation of static HTML files
- **Rebuildd**: Dedicated daemon to regenerate pages
- **Adaptive Cache**: Adjustment of intervals according to activity
- **Selective Invalidation**: Update of modified content
- **Periodic Reconstruction**: System to rebuild the catalog
- **Query Cache**: Storage of frequent results

## 6. Identified Technical Deficiencies

According to the forensic analysis documented in "soyspeedygonzales.md", the following deficiencies were identified:

### 6.1 Security

- **Critical vulnerabilities**: In Ghostscript and obsolete PHP (pre-7.x)
- **Inadequate validation**: No cryptographic verification or proper MIME validation
- **Outdated dependencies**: Critical CVEs unpatched
- **Basic permission model**: Binary system without responsibility segregation

### 6.2 Architecture and Performance

- **Lack of monitoring**: MTTD over 12 hours
- **Obsolete frontend**: Pre-HTML5, use of tables for layout (Lighthouse Score: 34/100)
- **Limited search**: Only in titles, without full indexing
- **Limited API**: Read-only JSON without versioning or authentication
- **Inefficient communication**: Via polling instead of real-time
- **Monolithic deployment**: In VMs with manual configuration
- **Insecure backups**: Without integrity verification

## 7. Modernization Plan

### 7.1 Architectural Proposals

- **Multi-layer security**: With cryptographic validation
- **CI/CD**: With automatic dependency auditing
- **Integrated observability**: With OpenTelemetry
- **Micro-frontends**: With Web Components
- **API Gateway**: With REST/GraphQL support
- **Real-time communication**: WebSockets/SSE
- **RBAC Framework**: With zero-trust architecture
- **Infrastructure as code**: Containers and Kubernetes
- **Digital preservation**: With geographic replication

### 7.2 Components to Rewrite

- **File validation pipeline**
- **Complete frontend** (migration to HTML5)
- **Search system**
- **API layer and integrations**
- **Moderation and access control systems**
- **Communication infrastructure**
- **Identity management platform**
- **Backup and archiving system**

### 7.3 Recommended Technologies

- **OCI Containers** with Kubernetes and service mesh
- **GitOps** for declarative management
- **OpenTelemetry** for instrumentation
- **Elasticsearch** for advanced search
- **Web Components** for micro-frontends
- **OAuth2/OIDC** for authentication
- **WebSockets/SSE** for real-time communication
- **Apache Kafka/RabbitMQ** as message broker
- **AI/ML** for assisted moderation

## 8. Phased Migration Strategy

Based on the technical analysis, a progressive migration is recommended that preserves existing functionality while modernizing individual components:

### Phase 1: Foundation and Security

1. **Update critical dependencies** (PHP, libraries)
2. **Implement basic observability**
3. **Containerize the existing application**
4. **Establish basic CI/CD pipeline**
5. **Strengthen authentication security**

### Phase 2: Backend Modernization

1. **Refactor data layer** (complete PDO)
2. **Implement versioned RESTful API**
3. **Develop modern authentication system**
4. **Update file processing pipeline**
5. **Implement distributed cache**

### Phase 3: Frontend Modernization

1. **Develop new UI components**
2. **Implement responsive theme system**
3. **Integrate real-time communication**
4. **Improve accessibility and performance**
5. **Develop adaptive views**

### Phase 4: Advanced Features

1. **Advanced search system**
2. **AI-assisted moderation**
3. **Anonymous reputation mechanisms**
4. **Notification platform**
5. **API expansion for integrations**

### Phase 5: Enterprise Infrastructure

1. **Complete Kubernetes implementation**
2. **Advanced orchestration with service mesh**
3. **Disaster recovery system**
4. **Advanced monitoring and alerts**
5. **Final performance optimization**

## 9. Conclusions

The 4chan project represents a legacy system with an architecture designed for efficiency and performance in an earlier era of web development. Despite its technical limitations, the system demonstrates effective design patterns for managing high traffic with limited resources.

The proposed migration seeks to maintain these efficiency principles while modernizing the architecture to address security, maintainability, and scalability deficiencies. The phased approach allows for a gradual transition that minimizes risk and maintains functionality throughout the process.

To achieve a successful migration, a multidisciplinary team with experience in the following areas will be necessary:
- Security engineering
- Distributed systems architecture
- Modern frontend development
- Data engineering
- DevOps and automation
- AI/ML for moderation systems

This document provides the technical foundation to begin this migration process and should be continuously updated as phases are completed.

---

Documentation prepared as part of the technical analysis for the migration of the 4chan system.
