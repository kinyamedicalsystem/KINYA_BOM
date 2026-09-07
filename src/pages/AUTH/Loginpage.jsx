import { useState, useCallback, useEffect } from "react";
import "./Loginpage.css";
import { supabase } from "../../supabase";

export default function LoginPage({ onLoginSuccess, logoutNotification }) {
    const [tab, setTab] = useState("login");
    const [loginform, setLoginform] = useState({ email: "", password: "" })
    const [signupform, setSignupform] = useState({ username: "", email: "", role: "", password: "", confirmpassword: "" })
    const [loding, setLoading] = useState({ signup: false, login: false })
    const [loginErrors, setloginErrors] = useState({})
    const [signupErrors, setsignupErrors] = useState({})
    const [loginnotification, setloginNotification] = useState({ show: false, message: '', type: '' })

    //loginnotification
    const handleloginNotification = useCallback((message, type = 'success') => {
        setloginNotification({ show: true, message, type });
        setTimeout(() => setloginNotification({ show: false, message: '', type: '' }), 2000);
    }, []);


    useEffect(() => {
        if (logoutNotification) {
            handleloginNotification(logoutNotification, 'success')
        }
      }, [handleloginNotification, logoutNotification])


    //Switch the Tabs
    const handleTabChange = (newTab) => {
        setTab(newTab);

        if (newTab === "sign-up") {
            setloginErrors({});
            setLoginform({
                email: "",
                password: ""
            });
        } else {
            setsignupErrors({});
            setSignupform({
                username: "",
                email: "",
                role: "",
                password: "",
                confirmpassword: ""
            });
        }
    };

    //SignUp Handlings
    //1.Signup OnChange
    const handleSignupchange = (e) => {
        const { name, value } = e.target
        setSignupform({ ...signupform, [name]: value })

        // Remove error when user starts correcting the field
        setsignupErrors(prev => ({ ...prev, [name]: "" }))
    }

    //2.Signup Data Validation with Errors Indication
    const validateSignup = () => {

        const errors = {};

        // Username
        if (!signupform.username.trim()) {

            errors.username = "Username is required";
        }
        else if (signupform.username.trim().length < 3) {

            errors.username = "Username must be at least 3 characters";
        }

        // Email
        if (!signupform.email.trim()) {

            errors.email = "Email is required";

        }
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(signupform.email)) {

            errors.email = "Enter a valid email address";

        }

        if (!signupform.role) {
            errors.role = "Please select a role"
        }

        // Password
        if (!signupform.password) {

            errors.password = "Password is required";

        }
        else if (signupform.password.length < 8) {

            errors.password = "Password must be at least 8 characters";

        }


        // Confirm Password
        if (!signupform.confirmpassword) {

            errors.confirmpassword = "Please confirm your password";

        }
        else if (signupform.password !== signupform.confirmpassword) {

            errors.confirmpassword = "Passwords do not match";
        }

        setsignupErrors(errors);

        return Object.keys(errors).length === 0;
    };

    //3.SignUp Submit
    const handleSignupsubmit = async (e) => {
        setLoading(prev => ({ ...prev, signup: true }))
        e.preventDefault()

        const isValid = validateSignup()

        if (!isValid) {
            setLoading(prev => ({ ...prev, signup: false }))
            return;
        }

       const {data:existingUser,error:checkerror}=await supabase
                .from("bom_user")
                .select("id")
                .eq("email",signupform.email)
                .maybeSingle()

              
      
       if(existingUser){
        handleloginNotification("This user already exist","error")
         setLoading(prev => ({ ...prev, signup: false }))
            return;
       }
     
      if(checkerror){
                console.log(checkerror)
                 handleloginNotification("Something went wrong ","error")
                 setLoading(prev => ({ ...prev, signup: false }))
               return;
            }

        const { error } = await supabase
            .from("bom_user")
            .insert({
                name: signupform.username,
                email: signupform.email,
                password: signupform.password,
                role: signupform.role
            })


        if (error) {
            handleloginNotification("Failed to save user details","error")
            setLoading(prev => ({ ...prev, signup: false }))
            return;
        }

        setTimeout(() => {
            setLoading(prev => ({
                ...prev, signup: false
            }))
        }, 1000)

        handleloginNotification("Created Successfully","success")

        setSignupform({
            username: "",
            email: "",
            password: "",
            confirmpassword: "",
            role: ""
        })

        setTab('login')

    }

    //Login Handlings
    //1.Login onChange
    const handleloginchange = (e) => {
        const { name, value } = e.target
        setLoginform({ ...loginform, [name]: value })

        // Remove error when user starts correcting the field
        setloginErrors(prev => ({ ...prev, [name]: "" }))
    }

    //2.Login Data Validation with Errors Indication
    const validateLogin = () => {

        const errors = {};

        //email
        if (!loginform.email.trim()) {
            errors.email = "Email is required";
        }
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(loginform.email)) {
            errors.email = "Enter a valid email address";
        }

        //password
        if (!loginform.password.trim()) {
            errors.password = "Password is required";
        }
        else if (loginform.password.length < 6) {
            errors.password = "Password must be at least 6 characters";
        }

        setloginErrors(errors);

        return Object.keys(errors).length === 0;
    };

    //3.Login Submit
    const handleLoginSubmit = async (e) => {
        e.preventDefault()

        setLoading(prev => ({
            ...prev, login: true
        }))

        const isValid = validateLogin()

        if (!isValid) {
            setLoading(prev => ({
                ...prev, login: false
            }))
            return;
        }

        const { data: profile, error: profileError } = await supabase
            .from("bom_user")
            .select("*")
            .eq("email", loginform.email)
            .eq("password", loginform.password)
            .single()

        if (profileError) {
            setLoading(prev => ({
                ...prev, login: false
            }))
            console.log(profileError)
            handleloginNotification("Incorrect Details","error")
            return;
        }

        setTimeout(() => {
            setLoading(prev => ({
                ...prev, login: false
            }))
        }, 1000)

        // Send user information to App.jsx
        const users = { bom_user: profile.name, bom_email: profile.email, bom_role: profile.role }
        onLoginSuccess(users);


    }

    return (
        <div className="auth-page">
            {/* Decorative background */}
            <div className="bg-circle circle-one"></div>
            <div className="bg-circle circle-two"></div>
            <div className="bg-circle circle-three"></div>

            <div className="auth-card">
                {/* LEFT SIDE */}
                <div className="left-banner">
                    <div className="brand">
                        <div className="brand-icon">
                            <span>B</span>
                        </div>
                        <div>
                            <h1>BOM</h1>
                            <p>Bill of Material</p>
                        </div>
                    </div>

                    <div className="left-content">
                        <span className="small-title">
                            INVENTORY MANAGEMENT
                        </span>
                        <h2>
                            Manage your products
                            <span> smarter.</span>
                        </h2>
                        <p>
                            Manage materials, products, stock and
                            production from one simple platform.
                        </p>

                        <div className="features">

                            <div className="feature">
                                <div className="feature-icon">✓</div>
                                <span>Easy stock management</span>
                            </div>

                            <div className="feature">
                                <div className="feature-icon">✓</div>
                                <span>Production tracking</span>
                            </div>

                            <div className="feature">
                                <div className="feature-icon">✓</div>
                                <span>Real-time inventory</span>
                            </div>

                        </div>
                    </div>

                    <div className="left-footer">
                        © 2026 BOM Management System
                    </div>

                </div>


                {/* RIGHT SIDE */}
                <div className="auth-form-section">
                    <div className="form-wrapper">
                        {/* TAB SWITCH */}
                        <div className="auth-tabs">
                            <button className={tab === "login" ? "active" : ""}
                                onClick={() => handleTabChange("login")}
                            >
                                Login
                            </button>

                            <button className={tab === "sign-up" ? "active" : ""}
                                onClick={() => handleTabChange("sign-up")}>
                                Sign Up
                            </button>
                        </div>

                        {/* LOGIN */}
                        {tab === "login" ? (
                            <form className="form-content" onSubmit={handleLoginSubmit}>
                                <div className="form-heading">
                                    <h2>Welcome back 👋</h2>
                                    <p> Login to continue to your account </p>
                                </div>

                                <div className="input-group">
                                    <label>Email Address</label>
                                    <div className={`input-box ${loginErrors.email ? "input-error" : ""}`} >
                                        <span><i className="fa-solid fa-envelope"></i></span>
                                        <input type="email"
                                            placeholder="Enter your email"
                                            name="email"
                                            value={loginform.email}
                                            onChange={handleloginchange}
                                        />
                                    </div>
                                    {loginErrors.email && (
                                        <small className="error-message">
                                            {loginErrors.email}
                                        </small>
                                    )}
                                </div>

                                <div className="input-group">
                                    <div className="label-row">
                                        <label>Password</label>
                                        <button className="forgot-btn" > Forgot password? </button>
                                    </div>
                                    <div className={`input-box  ${loginErrors.password ? "input-error" : ""}`}>
                                        <span><i className="fa-solid fa-lock"></i></span>
                                        <input type="password"
                                            placeholder="Enter your password"
                                            name="password"
                                            value={loginform.password}
                                            onChange={handleloginchange}
                                        />
                                    </div>
                                    {loginErrors.password && (
                                        <small className="error-message">
                                            {loginErrors.password}
                                        </small>
                                    )}
                                </div>

                                <button className="primary-btn" type="submit">{loding.login ? (<>Logging in...<span className="authspinner-ring"></span></>) : (<>Login<span>→</span></>)}</button>
                                <div className="divider">
                                    <span>or</span>
                                </div>

                                <p className="switch-text">
                                    Don't have an account?
                                    <button onClick={() => setTab("sign-up")} >Create account</button>
                                </p>
                            </form>

                        ) : (

                            /* SIGN UP */
                            <form className="form-content signup" onSubmit={handleSignupsubmit}>
                                <div className="form-heading">
                                    <h2>Create account +</h2>
                                    <p>Start managing your inventory today</p>
                                </div>

                                <div className="input-group">
                                    <label>Full Name</label>
                                    <div className={`input-box ${signupErrors.username ? "input-error" : ""}`}>
                                        <span><i className="fa-solid fa-user"></i></span>
                                        <input type="text"
                                            placeholder="Enter your name"
                                            name="username"
                                            value={signupform.username}
                                            onChange={handleSignupchange}
                                        />
                                    </div>
                                    {signupErrors.username && (<small className="error-message">{signupErrors.username}</small>)}
                                </div>

                                <div className="input-group">
                                    <label>Email Address</label>
                                    <div className={`input-box ${signupErrors.email ? "input-error" : ""}`}>
                                        <span><i className="fa-solid fa-envelope" /></span>
                                        <input type="email"
                                            placeholder="Enter your email"
                                            name="email"
                                            value={signupform.email}
                                            onChange={handleSignupchange} />
                                    </div>
                                    {signupErrors.email && (<small className="error-message">{signupErrors.email}</small>)}
                                </div>

                                <div className="input-group">
                                    <label>Role</label>
                                    <div className={`input-box ${signupErrors.role ? "input-error" : ""}`}>
                                        <span>◉</span>
                                        <select name="role" value={signupform.role} onChange={handleSignupchange}>
                                            <option value="">Select  a Role</option>
                                            <option value="user"> User</option>
                                            <option value="admin">Admin</option>
                                        </select>
                                    </div>
                                    {signupErrors.role && (<small className="error-message">{signupErrors.role}</small>)}
                                </div>

                                <div className="password-row">
                                    <div className="input-group">
                                        <label>Password</label>
                                        <div className={`input-box ${signupErrors.password ? "input-error" : ""}`}>
                                            <span><i className="fa-solid fa-lock"></i></span>
                                            <input type="password"
                                                placeholder="Password"
                                                name="password"
                                                value={signupform.password}
                                                onChange={handleSignupchange} />
                                        </div>
                                        {signupErrors.password && (<small className="error-message">{signupErrors.password}</small>)}
                                    </div>

                                    <div className="input-group">
                                        <label>Confirm</label>
                                        <div className={`input-box ${signupErrors.confirmpassword ? "input-error" : ""}`}>
                                            <span><i className="fa-solid fa-lock"></i></span>
                                            <input type="password"
                                                placeholder="Confirm"
                                                name="confirmpassword"
                                                value={signupform.confirmpassword}
                                                onChange={handleSignupchange}
                                            />
                                        </div>
                                        {signupErrors.confirmpassword && (<small className="error-message">{signupErrors.confirmpassword}</small>)}
                                    </div>
                                </div>

                                <button className="primary-btn" type="submit">  {loding.signup ? (<>Creating...<span className="authspinner-ring"></span> </>) : (<>Create <span className="arrow">→</span></>)}</button>
                                <p className="switch-text"> Already have an account?
                                    <button onClick={() => setTab("login")} >Login</button>
                                </p>
                            </form>
                        )}
                    </div>
                </div>
                
                {loginnotification.show && (
                    <div className={`indication-message ${loginnotification.type}`}>
                        <h6> <i className={`fas ${loginnotification.type === 'success' ? 'fa-check-circle' :
                                loginnotification.type === 'error' ? 'fa-exclamation-circle' :
                                    'fa-info-circle'
                            }`}></i> {loginnotification.message}</h6>
                    </div>)}

            </div>

        </div>
    );
}