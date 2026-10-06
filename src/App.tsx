import { Routes, Route, Navigate } from "react-router";
import { useAuth } from "@/lib/auth";
import AuthPage from "@/pages/AuthPage";
import MainPage from "@/pages/MainPage";

export default function App() {
  const { token } = useAuth();
  return (
    <Routes>
      <Route path="/" element={token ? <MainPage key={token} /> : <Navigate to="/auth" replace />} />
      <Route path="/auth" element={token ? <Navigate to="/" replace /> : <AuthPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
