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

interface IBuilder {
  type: 'application' | 'library' | 'server',
  name: string,
  framework: string,
  language: 'ts' | 'js',
  css: string,
  port: number,
}

interface IProjectBuilder {
  buildApp(args: IBuilder): Promise<void>;
  buildServer(args: IBuilder): Promise<void>;
  buildLibrary(args: IBuilder): Promise<void>;
}

const buildProject = (projectBuilderOverrides: Partial<IProjectBuilder>) => {
  const builder = {
    buildApp: async (args: IBuilder, replacements: IReplacements): Promise<void> => {
      await ncp(
        path.join(__dirname, `../templates/${args.type}/${args.framework}/base`),
        args.name,
        () => { } // TODO: change callback to convention
      )
      await ncp(
        path.join(__dirname, `../templates/${args.type}/${args.framework}/${replacements.LANGUAGE}`),
        args.name,
        () => { } // TODO: change callback to convention
      )

      const tailwind = args.css === 'Tailwind'
      replacements.CSS_EXTENSION = tailwind ? 'scss' : 'css'
      replacements.CONTAINER = tailwind
        ? 'mt-10 text-3xl mx-auto max-w-6xl'
        : 'container'
      replacements.CSS = tailwind ? 'Tailwind' : 'Empty CSS'
      replacements.PORT = args.port

      if (tailwind) {
        fs.unlinkSync(path.join(args.name, '/src/index.css'))

        await ncp(
          path.join(__dirname, '../templates/application-extras/tailwind'),
          args.name,
          () => { } // TODO: change callback to convention
        )

        const packageJSON = JSON.parse(
          fs.readFileSync(path.join(args.name, 'package.json'), 'utf8')
        )
        packageJSON.devDependencies.tailwindcss = '^2.0.2'
        fs.writeFileSync(
          path.join(args.name, 'package.json'),
          JSON.stringify(packageJSON, null, 2)
        )
      }
    },
    buildServer: async (args: IBuilder): Promise<void> => {
      await ncp(
        path.join(__dirname, `../templates/${args.type}/${args.framework}`),
        args.name,
        () => { } // TODO: change callback to convention
      )
    },
    buildLibrary: async (args: IBuilder): Promise<void> => {
      await ncp(path.join(__dirname, `../templates/${args.type}/typescript`), args.name, () => { }) // TODO: change callback to convention
    },
    ...projectBuilderOverrides
  }

  return async (args: IBuilder): Promise<void> => {
    const replacements: IReplacements = {
      NAME: args.name,
      FRAMEWORK: args.framework,
      SAFE_NAME: args.name.replace(/-/g, '_').trim(),
      LANGUAGE: args.language,
      PORT: args.port
    }

    switch (args.type) {
      case 'application':
        await builder.buildApp(args, replacements)
        break
      case 'server':
        await builder.buildServer(args)
        break
      case 'library':
        await builder.buildServer(args)
        break
    }

    renameGitignore(args.name)

    glob.sync(`${args.name}/**/*`).forEach((file) => {
      if (fs.lstatSync(file).isFile()) {
        templateFile(file, replacements)
      }
    })
  }
}

const templateFile = (fileName: string, replacements: IReplacements): void => {
  let contents = fs.readFileSync(fileName, 'utf8').toString()
  Object.keys(replacements).forEach((key) => {
    contents = contents.replace(
      new RegExp(`(\{\{${key}\}\}|\{\{ ${key} \}\})`, 'g'), //eslint-disable-line
      // TODO: fix this and remove ts ignore
      // @ts-ignore
      replacements[key]
    )
  })
  fs.writeFileSync(fileName, contents)
}

// required for npm publish
const renameGitignore = (projectName: string): void => {
  const projectPath = path.join(__dirname, `../${projectName}`)
  if (fs.existsSync(`${projectPath}/gitignore`)) {
    fs.renameSync(`${projectPath}/gitignore`, `${projectPath}/.gitignore`) //eslint-disable-line
  }
}

export { buildProject }
