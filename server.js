const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const path = require('path');
const moment = require('moment-timezone');
const app = express();
const PORT = 3000;
const { MongoClient } = require('mongodb');
const axios = require('axios');
const uri = 'mongodb://localhost:27017';
const dbName = 'mydb';
const collectionName = 'products';
const Schema = mongoose.Schema;

app.set('view engine', 'ejs');

mongoose.connect('mongodb://localhost:27017/mydb', { useNewUrlParser: true, useUnifiedTopology: true });

const userSchema = new mongoose.Schema({
    username: String,
    email: String,
    password: String
});

const UserModel = mongoose.model('User', userSchema);

const customerSchema = new mongoose.Schema({
    username: String,
    phone: String,
    address: String

});


const CustomerModel = mongoose.model('Customer', customerSchema);

const productSchema = new mongoose.Schema({
    name: String,
    price: String,
    username: String,
    clickCount: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
    totalPrice: Number
});

const dataSchema = new Schema({
    name: String,
    clickCount: Number,
    username: String,
    totalPrice: String,
    fullName: String,
    phoneNumber: String,
    email: String,
    address: String,
    paymentMethod: String
});

const Data = mongoose.model('Data', dataSchema);
app.get('/products', (req, res) => {
    MongoClient.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true })
        .then(client => {
            const db = client.db(dbName);
            const collection = db.collection(collectionName);

            collection.find({}).toArray()
                .then(products => {
                    res.json(products);
                })
                .catch(err => {
                    console.error('Lỗi truy vấn dữ liệu từ MongoDB:', err);
                    res.status(500).json({ error: 'Lỗi truy vấn dữ liệu từ MongoDB' });
                })
                .finally(() => {
                    client.close();
                });
        })
        .catch(err => {
            console.error('Kết nối tới MongoDB thất bại:', err);
            res.status(500).json({ error: 'Kết nối tới MongoDB thất bại' });
        });
});

const Product = mongoose.model('Product', productSchema);

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.get('/dangky', (req, res) => {
    res.sendFile(__dirname + '/register.html');
});
app.get('/home', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

app.post('/dangky', async (req, res) => {
    const { username, email, password } = req.body;

    try {
        const existingUser = await UserModel.findOne({ $or: [{ username }, { email }] });

        if (existingUser) {
            return res.send("<script>alert('Tên đăng nhập hoặc email đã tồn tại trong hệ thống. Vui lòng chọn tên đăng nhập hoặc email khác.');</script>");
        }

        const newUser = new UserModel({
            username,
            email,
            password
        });

        await newUser.save();

        res.redirect('/');
    } catch (error) {
        res.status(400).send('Đăng ký thất bại: ' + error);
    }
});

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/login.html');
});

app.get('/shopping', (req, res) => {
    res.sendFile(__dirname + '/shopping.html');
});
let data = [];

app.post('/', (req, res) => {
    const { username, password } = req.body;

    UserModel.findOne({ username, password })
        .then(user => {
            if (user) {
                res.redirect(`/home?username=${user.username}`);
            } else {
                res.send('Tên đăng nhập hoặc mật khẩu không chính xác!');
            }
        })
        .catch(error => {
            res.status(400).send('Đăng nhập thất bại: ' + error);
        });
});


app.post('/add-to-cart', async (req, res) => {
    const { name, price, username } = req.body;

    try {
        const existingProduct = await Product.findOne({ name, username });

        const currentTime = moment().tz('Asia/Ho_Chi_Minh');

        if (existingProduct) {

            const updatedClickCount = existingProduct.clickCount + 1;
            const priceNumber = parseFloat(existingProduct.price.replace(/[.₫]/g, ''));
            const totalPrice = priceNumber * updatedClickCount;

            await Product.updateOne(
                { name, username },
                { $set: { clickCount: updatedClickCount, createdAt: currentTime, totalPrice: totalPrice } }
            );

            res.json({ message: 'Cập nhật giỏ hàng thành công' });
        } else {

            const product = new Product({
                name,
                price,
                username,
                clickCount: 1,
                createdAt: currentTime,
                totalPrice: parseFloat(price.replace(/[.₫]/g, ''))
            });
            await product.save();
            res.json({ message: 'Thêm vào giỏ hàng thành công' });
        }
    } catch (error) {
        console.error('Error adding product to cart:', error); // Log lỗi
        res.status(500).json({ message: 'Failed to add product to cart' }); // Trả về lỗi
    }
});

app.post('/email', async (req, res) => {
    const { email } = req.body;

    try {

        const emailRegex = /\S+@\S+\.\S+/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ message: 'Định dạng email không hợp lệ' });
        }

        const existingEmail = await EmailModel.findOne({ email });

        if (existingEmail) {

            return res.status(400).json({ message: 'Email đã tồn tại trong hệ thống. Vui lòng nhập email khác.' });
        }

        const newEmail = new EmailModel({ email });
        await newEmail.save();

        res.status(201).json({ message: 'Đăng ký email thành công' });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ message: 'Đã xảy ra lỗi' });
    }
});

const emailSchema = new mongoose.Schema({
    email: String
});


app.get('/shopping', async (req, res) => {
    try {
        const product = await Product.findOne({ /* Điều kiện lấy sản phẩm */ });

        if (product) {
            res.render('shopping', { 
                productName: product.name, 
                productPrice: product.price,
                productClickCount: product.clickCount
            });
        } else {
            res.status(404).json({ message: 'Không tìm thấy sản phẩm' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.get('/api/data', async (req, res) => {
    try {
        const response = await axios.get('http://localhost:3000/products');
        const data = response.data;

        res.json(data);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ message: 'Đã xảy ra lỗi khi lấy dữ liệu từ API' });
    }
});
app.post('/api/saveData', async (req, res) => {
    const requestData = req.body;

    try {
        // Lấy giá trị tên sản phẩm từ phần tử productNameElement trong request body
        const productName = req.body.productName;

        // Tạo một instance mới của Data với thông tin từ request body
        const newData = new Data({
            name: productName,
            clickCount: requestData.clickCount,
            username: requestData.username,
            totalPrice: requestData.totalPrice,
            fullName: requestData.fullName,
            phoneNumber: requestData.phoneNumber,
            email: requestData.email,
            address: requestData.address,
            paymentMethod: requestData.paymentMethod
        });

        // Lưu dữ liệu vào cơ sở dữ liệu
        await newData.save();

        // Chuyển hướng người dùng đến trang home sau khi lưu dữ liệu thành công
        res.redirect('/home');
    } catch (error) {
        console.error('Error:', error);
        // Trả về lỗi 500 nếu có lỗi xảy ra trong quá trình lưu dữ liệu
        res.status(500).json({ message: 'Internal Server Error' });
    }
});


const EmailModel = mongoose.model('Email', emailSchema);
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
