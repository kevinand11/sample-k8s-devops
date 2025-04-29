import config from '@k11/eslint-config/base'

export default [
	...config,
	{
		rules: {
			'no-console': 'off'
		}
	}
]
