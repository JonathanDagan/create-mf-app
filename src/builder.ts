import fs from 'fs'
import path from 'path'
import glob from 'glob'

import { ncp } from 'ncp'

interface IReplacements {
    NAME: string,
    FRAMEWORK: string,
    SAFE_NAME: string,
    LANGUAGE: 'ts' | 'js',
    PORT?: number,
    CSS?: string,
    CSS_EXTENSION?: string,
    CONTAINER?: string,
}

const templateFile = (fileName: string, replacements: IReplacements) => {
    let contents = fs.readFileSync(fileName, 'utf8').toString()
    Object.keys(replacements).forEach((key) => {
        contents = contents.replace(
            new RegExp(`(\{\{${key}\}\}|\{\{ ${key} \}\})`, 'g'), //eslint-disable-line
            // TODO: fix this and remove ts ignore
            //@ts-ignore
            replacements[key]
        )
    })
    fs.writeFileSync(fileName, contents)
}

// required for npm publish
const renameGitignore = (projectName: string) => {
    const projectPath = path.join(__dirname, `../${projectName}`)
    if (fs.existsSync(`${projectPath}/gitignore`)) {
        fs.renameSync(`${projectPath}/gitignore`, `${projectPath}/.gitignore`) //eslint-disable-line
    }
}

// Options:
//   - type: "Application", "Library", "Server"
//   - name: Name of the project
//   - framework: Name of the framework
//   - language: Language of the project
//   - css: CSS framework
//   - port: Port to run the project on

interface IBuilder {
    type: "Application" | "Library" | "Server",
    name: string,
    framework: string,
    language: 'ts' | 'js',
    css: string,
    port: number,
}

module.exports = async ({ type, language, framework, name, css, port }: IBuilder) => {

    const replacements: IReplacements = {
        NAME: name,
        FRAMEWORK: framework,
        SAFE_NAME: name.replace(/-/g, '_').trim(),
        LANGUAGE: language
    }

    const tempDir = type.toLowerCase()

    if (type === 'Library') {
        await ncp(path.join(__dirname, `../templates/${tempDir}/typescript`), name, () => { }) // TODO: change callback to convention
    }

    if (type === 'Server') {
        replacements.PORT = port

        await ncp(
            path.join(__dirname, `../templates/${tempDir}/${framework}`),
            name,
            () => { } // TODO: change callback to convention
        )
    }

    if (type === 'Application') {
        await ncp(
            path.join(__dirname, `../templates/${tempDir}/${framework}/base`),
            name,
            () => { } // TODO: change callback to convention
        )
        await ncp(
            path.join(__dirname, `../templates/${tempDir}/${framework}/${replacements.LANGUAGE}`),
            name,
            () => { } // TODO: change callback to convention
        )

        const tailwind = css === 'Tailwind'
        replacements.CSS_EXTENSION = tailwind ? 'scss' : 'css'
        replacements.CONTAINER = tailwind
            ? 'mt-10 text-3xl mx-auto max-w-6xl'
            : 'container'
        replacements.CSS = tailwind ? 'Tailwind' : 'Empty CSS'
        replacements.PORT = port

        if (tailwind) {
            fs.unlinkSync(path.join(name, '/src/index.css'))

            await ncp(
                path.join(__dirname, '../templates/application-extras/tailwind'),
                name,
                () => { } // TODO: change callback to convention
            )

            const packageJSON = JSON.parse(
                fs.readFileSync(path.join(name, 'package.json'), 'utf8')
            )
            packageJSON.devDependencies.tailwindcss = '^2.0.2'
            fs.writeFileSync(
                path.join(name, 'package.json'),
                JSON.stringify(packageJSON, null, 2)
            )
        }
    }

    renameGitignore(name)

    glob.sync(`${name}/**/*`).forEach((file) => {
        if (fs.lstatSync(file).isFile()) {
            templateFile(file, replacements)
        }
    })
}
