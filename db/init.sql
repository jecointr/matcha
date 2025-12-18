-- Création de l'extension pour les UUIDs (si besoin de fonctions spécifiques, sinon gen_random_uuid() est natif)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- 1. TABLE USERS
-- Contient les infos de connexion ET de profil pour simplifier les requêtes de match
-- ==========================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL, -- Sera hashé (Argon2 ou bcrypt)
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    
    -- Confirmation de compte
    is_verified BOOLEAN DEFAULT FALSE,
    verification_token VARCHAR(255),
    
    -- Profil public
    gender VARCHAR(20), -- 'male', 'female', 'other'
    sexual_preference VARCHAR(20) DEFAULT 'bisexual', -- 'male', 'female', 'bisexual'
    biography TEXT,
    fame_rating INT DEFAULT 0,
    
    -- Localisation (GPS)
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    is_auto_locator BOOLEAN DEFAULT TRUE, -- Si l'utilisateur accepte la géoloc auto
    
    -- Statut
    last_connection TIMESTAMPTZ DEFAULT NOW(),
    is_online BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 2. IMAGES
-- Max 5 photos par user. On stocke le chemin/URL, pas le BLOB.
-- ==========================================
CREATE TABLE IF NOT EXISTS images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    file_path VARCHAR(255) NOT NULL,
    is_profile_picture BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 3. TAGS (Intérêts)
-- Système de tags réutilisables
-- ==========================================
CREATE TABLE IF NOT EXISTS tags (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL
);

-- Table de liaison User <-> Tags
CREATE TABLE IF NOT EXISTS user_tags (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    tag_id INT REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, tag_id)
);

-- ==========================================
-- 4. INTERACTIONS (Likes, Blocks, Reports)
-- ==========================================

-- Likes
CREATE TABLE IF NOT EXISTS likes (
    id SERIAL PRIMARY KEY,
    from_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    to_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_like UNIQUE (from_user_id, to_user_id),
    CHECK (from_user_id != to_user_id) -- On ne peut pas se liker soi-même
);

-- Visites (Historique)
CREATE TABLE IF NOT EXISTS visits (
    id SERIAL PRIMARY KEY,
    visitor_id UUID REFERENCES users(id) ON DELETE CASCADE,
    visited_id UUID REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
    -- Pas de contrainte UNIQUE ici car on veut voir chaque visite
);

-- Utilisateurs bloqués
CREATE TABLE IF NOT EXISTS blocks (
    blocker_id UUID REFERENCES users(id) ON DELETE CASCADE,
    blocked_id UUID REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (blocker_id, blocked_id)
);

-- Signalements (Fake accounts)
CREATE TABLE IF NOT EXISTS reports (
    reporter_id UUID REFERENCES users(id) ON DELETE CASCADE,
    reported_id UUID REFERENCES users(id) ON DELETE CASCADE,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (reporter_id, reported_id)
);

-- ==========================================
-- 5. CHAT & NOTIFICATIONS
-- ==========================================

CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    sender_id UUID REFERENCES users(id) ON DELETE CASCADE,
    receiver_id UUID REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    recipient_id UUID REFERENCES users(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES users(id) ON DELETE CASCADE, -- Qui a déclenché la notif
    type VARCHAR(50) NOT NULL, -- 'like', 'visit', 'message', 'match', 'unlike'
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
