import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { PrismaClient } from '@prisma/client'
import bcryptjs from 'bcryptjs'

const prisma = new PrismaClient()

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        console.log('Auth attempt:', credentials?.username)
        
        if (!credentials?.username || !credentials?.password) {
          console.log('Missing credentials')
          return null
        }

        try {
          const user = await prisma.user.findUnique({
            where: {
              username: credentials.username
            }
          })

          if (!user) {
            console.log('User not found:', credentials.username)
            return null
          }

          if (!user.isActive) {
            console.log('User not active:', credentials.username)
            return null
          }

          console.log('Checking password for user:', credentials.username)
          const passwordMatch = await bcryptjs.compare(credentials.password, user.password)
          
          if (!passwordMatch) {
            console.log('Password mismatch for user:', credentials.username)
            return null
          }

          console.log('Login successful for user:', credentials.username)

          await prisma.user.update({
            where: { id: user.id },
            data: { lastLogin: new Date() }
          })

          return {
            id: user.id,
            name: user.name,
            username: user.username,
            email: user.email,
            isFirstLogin: user.isFirstLogin,
            mustChangePassword: user.mustChangePassword
          }
        } catch (error) {
          console.error('Auth error:', error)
          return null
        }
      }
    })
  ],
  session: {
    strategy: 'jwt'
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.username = user.username
        token.isFirstLogin = user.isFirstLogin
        token.mustChangePassword = user.mustChangePassword
      }
      return token
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.sub!
        session.user.username = token.username as string
        session.user.isFirstLogin = token.isFirstLogin as boolean
        session.user.mustChangePassword = token.mustChangePassword as boolean
      }
      return session
    }
  },
  pages: {
    signIn: '/auth/login'
  }
}