import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase URL or Service Role Key in .env.local')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function resetPassword() {
    const { data: usersData, error: listError } = await supabase.auth.admin.listUsers()
    if (listError) {
        console.error('Error fetching users:', listError)
        return
    }

    const user = usersData.users.find(u => u.email === 'daniel.ekman@veidekke.no')
    if (!user) {
        console.log('User not found. Creating user instead...')
        const { data, error } = await supabase.auth.admin.createUser({
            email: 'daniel.ekman@veidekke.no',
            password: 'Veidekke2024!',
            email_confirm: true
        })
        if (error) console.error('Error creating user:', error)
        else console.log('User created successfully with password: Veidekke2024!')
        return
    }

    const { data, error } = await supabase.auth.admin.updateUserById(user.id, {
        password: 'Veidekke2024!'
    })

    if (error) {
        console.error('Error updating password:', error)
    } else {
        console.log('Password successfully reset to: Veidekke2024!')
    }
}

resetPassword()
