import Dashboard from "./Dashboard";
import Login from "./Login";

function App() {
  return window.location.pathname === "/dashboard" ? <Dashboard /> : <Login />;
}

export default App;
