USE sapience;

CREATE TABLE IF NOT EXISTS users (
    id CHAR(36) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(80) NOT NULL,
    avatar_file_id CHAR(36),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_settings (
    user_id CHAR(36) PRIMARY KEY,
    theme ENUM('light', 'dark', 'system') NOT NULL DEFAULT 'system',
    web_search_default BOOLEAN NOT NULL DEFAULT TRUE,
    default_section_id VARCHAR(255),

    CONSTRAINT fk_settings_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
    id CHAR(36) PRIMARY KEY,
    user_id CHAR(36) NOT NULL,
    token_hash CHAR(64) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    revoked_at TIMESTAMP NULL,

    CONSTRAINT fk_refresh_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
);

CREATE INDEX idx_refresh_user
ON refresh_tokens(user_id);


CREATE TABLE IF NOT EXISTS conversations (
    id CHAR(36) PRIMARY KEY,
    user_id CHAR(36) NOT NULL,
    title VARCHAR(200) NOT NULL DEFAULT 'New chat',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_conversation_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
);

CREATE INDEX idx_conv_user
ON conversations(user_id, updated_at);


CREATE TABLE IF NOT EXISTS messages (
    id CHAR(36) PRIMARY KEY,
    conversation_id CHAR(36) NOT NULL,
    role ENUM('user', 'assistant') NOT NULL,
    content TEXT NOT NULL,
    used_web_search BOOLEAN NOT NULL DEFAULT FALSE,
    status VARCHAR(12) NOT NULL DEFAULT 'complete',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_message_conversation
        FOREIGN KEY (conversation_id)
        REFERENCES conversations(id)
        ON DELETE CASCADE
);

CREATE INDEX idx_msg_conv
ON messages(conversation_id, created_at);


CREATE TABLE IF NOT EXISTS message_sources (
    id CHAR(36) PRIMARY KEY,
    message_id CHAR(36) NOT NULL,
    position SMALLINT NOT NULL,
    title VARCHAR(300),
    url TEXT NOT NULL,
    snippet TEXT,

    UNIQUE KEY unique_message_position (message_id, position),

    CONSTRAINT fk_source_message
        FOREIGN KEY (message_id)
        REFERENCES messages(id)
        ON DELETE CASCADE
);


CREATE TABLE IF NOT EXISTS files (
    id CHAR(36) PRIMARY KEY,
    user_id CHAR(36) NOT NULL,
    message_id CHAR(36) NULL,
    storage_key VARCHAR(255) UNIQUE NOT NULL,
    original_name VARCHAR(255),
    mime_type VARCHAR(100) NOT NULL,
    size_bytes INT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_file_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_file_message
        FOREIGN KEY (message_id)
        REFERENCES messages(id)
        ON DELETE SET NULL
);

CREATE INDEX idx_files_user
ON files(user_id);


CREATE TABLE IF NOT EXISTS connected_accounts (
    id CHAR(36) PRIMARY KEY,
    user_id CHAR(36) NOT NULL,
    provider ENUM('microsoft') NOT NULL,
    provider_email VARCHAR(255),
    access_token_enc TEXT NOT NULL,
    refresh_token_enc TEXT,
    scopes TEXT,
    access_expires_at TIMESTAMP NULL,
    status VARCHAR(12) NOT NULL DEFAULT 'active',
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY unique_user_provider (user_id, provider),

    CONSTRAINT fk_connected_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
);


CREATE TABLE IF NOT EXISTS oauth_states (
    state VARCHAR(64) PRIMARY KEY,
    user_id CHAR(36) NOT NULL,
    code_verifier VARCHAR(128) NOT NULL,
    expires_at TIMESTAMP NOT NULL,

    CONSTRAINT fk_oauth_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
);


CREATE TABLE IF NOT EXISTS saved_items (
    id CHAR(36) PRIMARY KEY,
    user_id CHAR(36) NOT NULL,
    message_id CHAR(36) NULL,
    title VARCHAR(200),
    onenote_page_id VARCHAR(255),
    onenote_page_url TEXT,
    section_name VARCHAR(255),
    status VARCHAR(10) NOT NULL DEFAULT 'success',
    error_message TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_saved_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_saved_message
        FOREIGN KEY (message_id)
        REFERENCES messages(id)
        ON DELETE SET NULL
);

CREATE INDEX idx_saved_user
ON saved_items(user_id, created_at);