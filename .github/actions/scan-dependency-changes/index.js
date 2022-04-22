const core = require('@actions/core');
const shell = require('shelljs');
const fs = require('fs');
const { Octokit } = require("@octokit/rest");
const convert = require('xml-js');
let octokit;

async function main() {
    try {
        const orgName = core.getInput('gthub-org-name');
        const gthubUsername = core.getInput('gthub-username');
        const gthubToken = core.getInput('gthub-token');
        const dependencyRepoName = core.getInput('dependency-repo-name') || "dependency-details";

        octokit = new Octokit({ auth: gthubToken });

        await shell.mkdir('-p', 'temp');
        await shell.cd('temp');

        // clone the dependency repo
        const dependencyRepoUrl = `https://${gthubUsername}:${gthubToken}@github.com/${orgName}/${dependencyRepoName}.git`;
        await shell.exec(`git clone ${dependencyRepoUrl}`);

        // read the maven_dependencies_with_repo.json file
        const mavenDependenciesWithRepo = JSON.parse(fs.readFileSync(`./${dependencyRepoName}/maven_dependencies_with_repo.json`, 'utf8'));
        console.log(`mavenDependenciesWithRepo: ${JSON.stringify(mavenDependenciesWithRepo)}`);
        
        // read the node_dependencies_with_repo.json file
        const nodeDependenciesWithRepo = JSON.parse(fs.readFileSync(`./${dependencyRepoName}/node_dependencies_with_repo.json`, 'utf8'));
        console.log(`nodeDependenciesWithRepo: ${JSON.stringify(nodeDependenciesWithRepo)}`);

        await shell.cd('..');
        await shell.rm('-rf', 'temp');

        let newPomDepenencies = [];
        if(fs.existsSync('pom.xml')) {
            // read the pom.xml file
            const pomXml = fs.readFileSync('pom.xml', 'utf8');
            const jsonFromPomXml = await convert.xml2json(pomXml, {compact: true, spaces: 4});
            let pomXmlJson = JSON.parse(jsonFromPomXml);
            console.log(`pomXmlJson: ${JSON.stringify(pomXmlJson)}`);

            // get the dependencies from the pom.xml
            let pomdependencies = {};
            if(pomXmlJson.project.dependencies) {
                pomdependencies = pomXmlJson.project.dependencies.dependency;
            } else if(pomXmlJson.project.dependencyManagement) {
                pomdependencies = pomXmlJson.project.dependencyManagement.dependencies.dependency;
            }
            const dependencies = getMavenRepoDependencies(pomdependencies);
            console.log(`dependencies: ${JSON.stringify(dependencies)}`);

            // get the new dependencies
            newPomDepenencies = getNewPomDependencies(dependencies, mavenDependenciesWithRepo);
            console.log(`newPomDepenencies: ${JSON.stringify(newPomDepenencies)}`);
        }

        let newPackageJsonDepenencies = [];
        if(fs.existsSync('package.json')) {
            // read the package.json file
            const packageJson = fs.readFileSync('package.json', 'utf8');
            let packageJsonJson = JSON.parse(packageJson);
            console.log(`packageJsonJson: ${JSON.stringify(packageJsonJson)}`);

            // get the dependencies from the package.json
            const nodeDependencies = getNodeRepoDependencies(packageJsonJson);
            console.log(`nodeDependencies: ${JSON.stringify(nodeDependencies)}`);

            // get the new dependencies
            newPackageJsonDepenencies = getNewPackageJsonDependencies(packageJsonJson.name, nodeDependencies, nodeDependenciesWithRepo);
            console.log(`newPackageJsonDepenencies: ${JSON.stringify(newPackageJsonDepenencies)}`);
        }
        
    } catch (error) {
        console.log(error);
    }
}

function getNodeRepoDependencies(packageJson) {
    let dependencies = [];
    if(packageJson.dependencies) {
        for(let key in packageJson.dependencies) {
            dependencies.push({
                name: key,
                version: packageJson.dependencies[key]
            });
        }
    }

    if(packageJson.devDependencies) {
        for(let key in packageJson.devDependencies) {
            dependencies.push({
                name: key,
                version: packageJson.devDependencies[key]
            });
        }
    }
    
    return dependencies;
}

function getMavenRepoDependencies(dependencies) {
    let mavenDependencies = [];
    if(dependencies) {
        if(Array.isArray(dependencies)) {
            for(let i = 0; i < dependencies.length; i++) {
                const dependency = dependencies[i];
                if(dependency.version) {
                    mavenDependencies.push({
                        groupId: dependency.groupId._text,
                        artifactId: dependency.artifactId._text,
                        version: dependency.version._text
                    });
                } else {
                    mavenDependencies.push({
                        groupId: dependency.groupId._text,
                        artifactId: dependency.artifactId._text
                    });
                }
            }
        } else {
            if(dependencies.version) {
                mavenDependencies.push({
                    groupId: dependencies.groupId._text,
                    artifactId: dependencies.artifactId._text,
                    version: dependencies.version._text
                });
            } else {
                mavenDependencies.push({
                    groupId: dependencies.groupId._text,
                    artifactId: dependencies.artifactId._text
                });
            }
        }
    }
    return mavenDependencies;
}

function getNewPackageJsonDependencies(reoName, packageJson, dependencies) {
    console.log(`packageJson: ${JSON.stringify(packageJson)}`);
    console.log(`dependencies: ${JSON.stringify(dependencies)}`);

    let newDependencies = [];
    if(dependencies.length > 0) {
        for(let i = 0; i < dependencies.length; i++) {
            const dependency = dependencies[i];

            if(dependency.repoName === reoName) {
                console.log("matched");
                let existingRepoDependencies = dependency.dependencies;

                for(let loopVarPackageJson = 0; loopVarPackageJson < packageJson.length; loopVarPackageJson++) {
                    const packageJsonDependency = packageJson[loopVarPackageJson];
                    let ifDepenencyExists = false;
                    for(let loopVarExistingRepoDependencies = 0; loopVarExistingRepoDependencies < existingRepoDependencies.length; loopVarExistingRepoDependencies++) {
                        const existingRepoDependency = existingRepoDependencies[loopVarExistingRepoDependencies];

                        console.log(`packageJsonDependency: ${JSON.stringify(packageJsonDependency)}`);
                        console.log(`existingRepoDependency: ${JSON.stringify(existingRepoDependency)}`);
                        if(packageJsonDependency.name == existingRepoDependency.name && packageJsonDependency.version == existingRepoDependency.version) {
                            ifDepenencyExists = true;
                        }
                    }
                    if(!ifDepenencyExists) {
                        newDependencies.push({name: packageJsonDependency.name, version: packageJsonDependency.version});
                    }
                }
                break;
            }
        }
    }

    console.log(`newDependencies: ${JSON.stringify(newDependencies)}`);

    return newDependencies;
}

function getNewPomDependencies(pomXml, dependencies) {
    let newPomXml = {};
    if(pomXml.project.dependencies) {
        newPomXml.project.dependencies = {};
        for(let key in pomXml.project.dependencies) {
            newPomXml.project.dependencies[key] = pomXml.project.dependencies[key];
        }
    }

    if(dependencies) {
        for(let i = 0; i < dependencies.length; i++) {
            const dependency = dependencies[i];
            if(dependency.version) {
                newPomXml.project.dependencies[dependency.name] = {
                    groupId: dependency.groupId,
                    artifactId: dependency.artifactId,
                    version: dependency.version
                };
            } else {
                newPomXml.project.dependencies[dependency.name] = {
                    groupId: dependency.groupId,
                    artifactId: dependency.artifactId
                };
            }
        }
    }

    return newPomXml;
}

main();