import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.Statement;
import java.sql.ResultSet;
import javax.servlet.http.HttpServletRequest;

public class AuthManager {
    
    // OWASP A07:2021 - Hardcoded Credentials
    private static final String DB_USER = "admin";
    private static final String DB_PASS = "supersecret_db_password_123";

    public boolean authenticateUser(HttpServletRequest request) {
        String username = request.getParameter("username");
        String password = request.getParameter("password");
        
        try {
            Connection conn = DriverManager.getConnection("jdbc:mysql://localhost:3306/users", DB_USER, DB_PASS);
            Statement stmt = conn.createStatement();
            
            // OWASP A03:2021 - SQL Injection (Concatenation)
            String query = "SELECT * FROM users WHERE username = '" + username + "' AND password = '" + password + "'";
            ResultSet rs = stmt.executeQuery(query);
            
            return rs.next();
        } catch (Exception e) {
            // OWASP A05:2021 - Security Misconfiguration (Information Leakage)
            e.printStackTrace();
            return false;
        }
    }
}
