import { Navigate, useLocation, Outlet } from 'react-router-dom';

export default function PrivateRoute() {
  const location = useLocation();
  const token = localStorage.getItem('github_token');
  
  console.log('PrivateRoute check:', {
    hasToken: !!token,
    currentPath: location.pathname
  });

  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
} 