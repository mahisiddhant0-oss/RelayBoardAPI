import jwt from 'jsonwebtoken'
import express from 'express'
import bcrypt from 'bcryptjs'
import prisma from '../prismaClient.js'



const router  = express.Router()

router.post('/register',async (req,res)=>{
    const {username,password} = req.body
    if (typeof username !== 'string' || username.trim() === '') {
        return res.status(400).json({
            message: 'Username is required'
        })
        }

        if (typeof password !== 'string' || password.length < 8) {
        return res.status(400).json({
            message: 'Password must be at least 8 characters long'
        })
    }

    const hashedPassword = bcrypt.hashSync(password,8)


    try{
        const user = await prisma.user.create({
            data :{
                username ,
                password : hashedPassword
            }
        })



        const token = jwt.sign({ id:  user.id} , process.env.JWT_SECRET, {expiresIn : '24h'})
        return res.status(201).json({ token })
    }
    catch(err){

        if(err.code==='P2002'){
            return res.status(409).json({
                message : 'Username already exists'
            })
        }

        console.error(err)
            return res.status(500).json({
                message : 'Unable to create user'
            })
    }





})

router.post('/login',async(req,res)=>{
    const {username,password} = req.body

    if(typeof username !=='string' || username.trim() === ''){
        return res.status(400).json({
            message : 'Username is required'
        })
    }

    if(typeof password !=='string' || password === ''){
        return res.status(400).json({
            message : 'Password is required'
        })
    }

    try{
        const user = await prisma.user.findUnique({
            where : {
                username : username
            }
        })


        if (!user) {
            return res.status(401).json({
                message: 'Invalid credentials'
            })
        }

        const passwordIsValid = bcrypt.compareSync(password , user.password)
        if (!passwordIsValid) {
        return res.status(401).json({ message: "Invalid credentials" })
        }

        const token = jwt.sign({id : user.id} , process.env.JWT_SECRET,{expiresIn : '24h'})
        res.json({token})

    }catch(err){
        console.error(err)
        return res.status(500).json({
            message : 'Unable to login right now'
        })
    }
})


export default router
