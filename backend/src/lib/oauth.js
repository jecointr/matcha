import axios from 'axios';
import { queryOne, query } from '../config/database.js';

/**
 * Handle OAuth login manually (replaces Passport strategy)
 */
export const handleOAuthUser = async (provider, profile) => {
  const { id: providerId, email, username, firstName, lastName } = profile;

  if (!email) {
    throw new Error('No email found from provider');
  }

  const safeFirstName = firstName || 'User';
  const safeLastName = lastName || ' '; 

  let user = await queryOne(
    'SELECT * FROM users WHERE auth_provider = $1 AND auth_id = $2',
    [provider, providerId]
  );

  if (user) return user;

  user = await queryOne('SELECT * FROM users WHERE email = $1', [email]);

  if (user) {
    await query(
      'UPDATE users SET auth_provider = $1, auth_id = $2, is_verified = true WHERE id = $3',
      [provider, providerId, user.id]
    );
    return user;
  }

  let finalUsername = username || email.split('@')[0];
  finalUsername = finalUsername.substring(0, 40);
  
  const uniqueSuffix = Math.floor(Math.random() * 10000);
  finalUsername = `${finalUsername}_${uniqueSuffix}`;

  const newUser = await queryOne(
    `INSERT INTO users (
      email, username, first_name, last_name, 
      auth_provider, auth_id, is_verified, is_profile_complete
    ) VALUES ($1, $2, $3, $4, $5, $6, true, false)
    RETURNING *`,
    [email, finalUsername, safeFirstName, safeLastName, provider, providerId]
  );

  return newUser;
};

export const getGoogleAuthURL = () => {
  const rootUrl = 'https://accounts.google.com/o/oauth2/v2/auth';
  const options = {
    redirect_uri: `${process.env.API_URL || 'http://localhost:3000'}/api/auth/google/callback`,
    client_id: process.env.GOOGLE_CLIENT_ID,
    access_type: 'offline',
    response_type: 'code',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/userinfo.email',
    ].join(' '),
  };
  return `${rootUrl}?${new URLSearchParams(options).toString()}`;
};

export const getGoogleUser = async (code) => {
  const { data } = await axios.post('https://oauth2.googleapis.com/token', {
    code,
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    redirect_uri: `${process.env.API_URL || 'http://localhost:3000'}/api/auth/google/callback`,
    grant_type: 'authorization_code',
  });

  const { data: googleUser } = await axios.get(
    'https://www.googleapis.com/oauth2/v1/userinfo',
    {
      headers: { Authorization: `Bearer ${data.access_token}` },
    }
  );

  return {
    id: googleUser.id,
    email: googleUser.email,
    username: googleUser.name,
    firstName: googleUser.given_name || googleUser.name || 'User',
    lastName: googleUser.family_name || '',
  };
};

export const getGithubAuthURL = () => {
  const rootUrl = 'https://github.com/login/oauth/authorize';
  const options = {
    client_id: process.env.GITHUB_CLIENT_ID,
    redirect_uri: `${process.env.API_URL || 'http://localhost:3000'}/api/auth/github/callback`,
    scope: 'user:email',
  };
  return `${rootUrl}?${new URLSearchParams(options).toString()}`;
};

export const getGithubUser = async (code) => {
  const { data } = await axios.post(
    'https://github.com/login/oauth/access_token',
    {
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
    },
    { headers: { Accept: 'application/json' } }
  );

  if (data.error) throw new Error(data.error_description);

  const { data: githubUser } = await axios.get('https://api.github.com/user', {
    headers: { Authorization: `Bearer ${data.access_token}` },
  });

  const { data: emails } = await axios.get('https://api.github.com/user/emails', {
    headers: { Authorization: `Bearer ${data.access_token}` },
  });
  
  const primaryEmail = emails.find(e => e.primary && e.verified)?.email;

  const [first, ...last] = (githubUser.name || githubUser.login).split(' ');

  return {
    id: String(githubUser.id),
    email: primaryEmail,
    username: githubUser.login,
    firstName: first || 'User',
    lastName: last.join(' ') || '',
  };
};