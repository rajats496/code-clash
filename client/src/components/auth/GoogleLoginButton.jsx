import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const GoogleLoginButton = () => {
  const { loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  const handleSuccess = async (credentialResponse) => {
    const result = await loginWithGoogle(credentialResponse.credential);

    if (result.success) {
      console.log('Login successful!');
      navigate('/matchmaking'); // Redirect to matchmaking page
    } else {
      alert(`Login failed: ${result.error}`);
    }
  };

  const handleError = () => {
    console.error('Google login failed');
    alert('Google login failed. Please try again.');
  };

  return (
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
      <div className="flex justify-center">
        <GoogleLogin
          onSuccess={handleSuccess}
          onError={handleError}
          useOneTap={false}
          theme="filled_blue"
          size="large"
          text="continue_with"
        />
      </div>
    </GoogleOAuthProvider>
  );
};

export default GoogleLoginButton;