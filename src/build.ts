import { images } from './charts/commons/images'

async function main () {
	for (const [app, image] of Object.entries(images)) {
		console.log(`Building and pushing: ${app}`)
		await image.build()
		await image.push()
	}
}

main()