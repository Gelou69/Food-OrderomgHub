// components/auth/AuthPage.jsx
import React, { useState } from 'react';
import { supabase } from '../../config/supabase';
import { ORANGE } from '../../config/constants';
import { FoodButton } from '../common/FoodButton';
import { StyledInput } from '../common/StyledInput';

export const AuthPage = ({ onSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [error, setError] = useState('');

  const handleAuth = async () => {
    setError('');
    if (!email || !password) {
      setError('Please fill in both fields.');
      return;
    }
    
    try {
      let result;
      if (isLogin) {
        result = await supabase.auth.signInWithPassword({ email, password });
      } else {
        result = await supabase.auth.signUp({ email, password });
      }
      
      if (result.error) {
        throw new Error(result.error.message);
      }
      
      if (result.data.user) {
        onSuccess();
      } else if (result.data.session === null && !isLogin) {
        setError('Account created. Please check your email to confirm your account before logging in.');
        setIsLogin(true); 
      }

    } catch (e) {
      console.error(e);
      setError(e.message || 'Authentication failed.');
    }
  };
  
  return (
    <div className="flex justify-center items-center h-full w-full py-10"> 
      <div className="p-6 md:p-10 bg-white rounded-2xl shadow-2xl mx-4 w-full max-w-md">
        <h2 className="text-3xl font-extrabold mb-8 text-center" style={{ color: ORANGE }}>
          {isLogin ? 'Welcome Back to Iligan Food!' : 'Join the Food Delivery Family'}
        </h2>
        
        <div className='space-y-4'>
          <StyledInput
            type="email"
            placeholder="Email Address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <StyledInput
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        
        {error && <p className="text-sm text-red-500 mt-4 font-medium">{error}</p>}
        
        <div className='mt-8'>
          <FoodButton onClick={handleAuth}>
            {isLogin ? 'Login Securely' : 'Sign Up Now'}
          </FoodButton>
        </div>
        
        <p className="mt-6 text-center text-gray-500 text-sm">
          {isLogin ? "Don't have an account?" : "Already have an account?"}
          <button 
            onClick={() => { setIsLogin(!isLogin); setError(''); }}
            className="ml-2 font-bold hover:underline"
            style={{ color: ORANGE }}
          >
            {isLogin ? 'Sign Up' : 'Login'}
          </button>
        </p>
      </div>
    </div>
  );
};