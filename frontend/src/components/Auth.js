import React, { useState } from 'react';
import { auth } from '../firebase/config';
import { 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword,
    GoogleAuthProvider,
    signInWithPopup
} from 'firebase/auth';
import LogoRibbons from './LogoRibbons';

const Auth = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLogin, setIsLogin] = useState(true);
    const [error, setError] = useState('');

    const handleEmailAuth = async (e) => {
        e.preventDefault();
        try {
            if (isLogin) {
                await signInWithEmailAndPassword(auth, email, password);
            } else {
                await createUserWithEmailAndPassword(auth, email, password);
            }
        } catch (error) {
            setError(error.message);
        }
    };

    const handleGoogleAuth = async () => {
        const provider = new GoogleAuthProvider();
        try {
            await signInWithPopup(auth, provider);
        } catch (error) {
            setError(error.message);
        }
    };

    return (
        <div className="auth-container">
            <LogoRibbons />
            <h2>{isLogin ? 'Login' : 'Sign Up'}</h2>
            <form onSubmit={handleEmailAuth}>
                <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                />
                <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                />
                <button type="submit">
                    {isLogin ? 'Login' : 'Sign Up'}
                </button>
            </form>
            <button onClick={handleGoogleAuth} className="google-btn">
                Continue with Google
            </button>
            <p onClick={() => setIsLogin(!isLogin)}>
                {isLogin ? 'Need an account? Sign up' : 'Already have an account? Login'}
            </p>
            {error && <p className="error">{error}</p>}
        </div>
    );
};

export default Auth;