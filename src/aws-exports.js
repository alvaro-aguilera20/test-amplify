const awsconfig = {
  Auth: {
    Cognito: {
      userPoolId: '', // Reemplaza con tu User Pool ID
      userPoolClientId: '', // Reemplaza con tu App Client ID
      signUpVerificationMethod: 'code',
      loginWith: {
        username: true
      }
    }
  },
  API: {
    REST: {
      'api-banco': {
        endpoint: 'https://qw81piu9tk.execute-api.us-east-1.amazonaws.com'
      }
    }
  }
};

export default awsconfig;