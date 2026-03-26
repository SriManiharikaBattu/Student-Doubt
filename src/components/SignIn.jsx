import { useState } from 'react';

export default function SignIn({ onSignIn }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (username.trim()) {
      onSignIn(username);
    }
  };

  return (
    <div className="page-container glass-panel">
      <div className="signin-header">
        <div className="logo-icon">
          <i className="ri-brain-line"></i>
        </div>
        <h1>Doubt Solver AI</h1>
        <p>Your personal AI tutor for step-by-step clarity.</p>
      </div>
      <form onSubmit={handleSubmit}>
        <div className="input-group">
          <i className="ri-user-line"></i>
          <input
            type="text"
            placeholder="Student ID or Email"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>
        <div className="input-group">
          <i className="ri-lock-line"></i>
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <button type="submit" className="btn-primary">
          <span>Sign In</span>
          <i className="ri-arrow-right-line"></i>
        </button>
      </form>
    </div>
  );
}
