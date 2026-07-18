import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { AuthProvider } from "./context/AuthContext";
window.addEventListener('online', () => {
  console.log('App is back online!');
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>
);
