// src/routes/AdminRoute.jsx
import PrivateRoute from "../routes/PrivateRoute.jsx";

const AdminRoute = ({ children }) => {
    return <PrivateRoute adminOnly>{children}</PrivateRoute>;
};

export default AdminRoute;
