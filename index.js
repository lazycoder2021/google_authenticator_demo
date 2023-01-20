const express = require('express')
const mongoose = require('mongoose'); 
const sqlite3 = require('sqlite3') // replace with mongoose 
const session = require('express-session')
const { authenticator } = require('otplib')
const QRCode = require('qrcode')
const jwt = require('jsonwebtoken')
const expressJWT = require('express-jwt')
const bodyParser = require('body-parser')
const app = express()
const port = 3000
const User = require('./models/User'); 


app.set('view engine', 'ejs')

app.use(session({
  secret: 'supersecret',
}))

mongoose.set('strictQuery', false)

//mongoose.connect('mongodb://localhost:27017/totpAuth'); 

mongoose.connect('mongodb+srv://dbuser:dbuser@cluster0.3e9dhjg.mongodb.net/?retryWrites=true&w=majority')

mongoose.connection.on('open', function () {
    console.log('db connected...')
})



app.use(bodyParser.urlencoded({ extended: false }))

app.get('/', (req, res) => {
  res.render('signup.ejs')
})

app.post('/sign-up', async (req, res) => {
    const userExists = await User.findOne({ email: req.body.email });
    
    if (userExists) {
        console.log('user already exists')
        return res.send('user already exists, click back to go back')
    }
    
  const email = req.body.email,
      secret = authenticator.generateSecret()

    const user = new User({
        email: req.body.email,
        secret: secret
    })

    await user.save();

    QRCode.toDataURL(authenticator.keyuri(email, '2FA Node App', secret), (err, url) => {
        if (err) {
            throw err
        }

        req.session.qr = url
        req.session.email = email
        console.log(req.session.qr, req.session.email)
        res.redirect('/sign-up-2fa')
    })

  const db = new sqlite3.Database('db.sqlite') // replace with mongoose [checkout model parameters]
  
})

app.get('/sign-up-2fa', (req, res) => {
  if (!req.session.qr) {
    return res.redirect('/')
  }

  return res.render('signup-2fa.ejs', { qr: req.session.qr })
})

app.post('/sign-up-2fa', (req, res) => {
  if (!req.session.email) {
    return res.redirect('/')
  }

  const email = req.session.email,
      code = req.body.code
    console.log(email, code)

  return verifyLogin(email, code, req, res, '/sign-up-2fa')
})

const jwtMiddleware = expressJWT({
  secret: 'supersecret',
  algorithms: ['HS256'],
  getToken: (req) => {
    return req.session.token
  }
})

app.get('/login', (req, res) => {
  return res.render('login.ejs')
})

app.post('/login', (req, res) => {
  //verify login
  const email = req.body.email,
    code = req.body.code

  return verifyLogin(email, code, req, res, '/login')
})

app.get('/private', jwtMiddleware, (req, res) => {
  return res.render('private.ejs', {email: req.user})
})

app.get('/logout', jwtMiddleware, (req, res) => {
  req.session.destroy()
  return res.redirect('/')
})

async function verifyLogin (email, code, req, res, failUrl) {
  //load user by email

    const user = await User.findOne({ email: email }); 
    console.log(user)
    console.log(user.secret)
    if (user) {
        if (authenticator.check(code, user.secret)) {
            
            req.session.qr = null
            req.session.email = null
            req.session.token = jwt.sign(email, 'supersecret')
            return res.redirect('/private')
            
        } else {
            return res.redirect(failUrl)
 
        }

    } else {
        return res.redirect('/')
    }

    /*

  const db = new sqlite3.Database('db.sqlite') // your mongo code should go here......
  db.serialize(() => {
    db.get('SELECT secret FROM users WHERE email = ?', [email], (err, row) => {
      if (err) {
        throw err
      }

      if (!row) {
        return res.redirect('/')
      }

      if (!authenticator.check(code, row.secret)) {
        //redirect back
        return res.redirect(failUrl)
      }

      //correct, add jwt to session
      req.session.qr = null
      req.session.email = null
      req.session.token = jwt.sign(email, 'supersecret')

      //redirect to "private" page
      return res.redirect('/private')
    })
  }) // again replace with mongoose
  */
}

//create database with tables if it doesn't exist

/*
const db = new sqlite3.Database('db.sqlite')
db.serialize(() => {
  db.run('CREATE TABLE IF NOT EXISTS `users` (`user_id` INTEGER PRIMARY KEY AUTOINCREMENT, `email` VARCHAR(255) NOT NULL, `secret` varchar(255) NOT NULL)')
})
db.close()no
*/

app.listen(port, () => {
  console.log(`2FA Node app listening at http://localhost:${port}`)
})