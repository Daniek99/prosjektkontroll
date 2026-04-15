const fs = require('fs');
const path = require('path');

function walk(dir) {
    fs.readdirSync(dir).forEach(file => {
        let fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            walk(fullPath);
        } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            content = content.replace(/import React from 'react';\r?\n?/g, '');
            content = content.replace(/import React, \{ /g, 'import { ');
            content = content.replace(/import \{ Session, User \} from '@supabase\/supabase-js';/g, "import type { Session, User } from '@supabase/supabase-js';");
            fs.writeFileSync(fullPath, content);
        }
    });
}
walk('./src');
