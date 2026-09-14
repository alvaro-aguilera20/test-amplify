import React from 'react'
import { withAuthenticator, Button, Heading, View } from '@aws-amplify/ui-react'

function App({ signOut, user }) {
  return (
    <View style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Heading level={2}>Plataforma de Pagos Serverless</Heading>
        <div>
          <span style={{ marginRight: '15px' }}>
            Usuario: <strong>{user?.username || user?.attributes?.email}</strong>
          </span>
          <Button variation="link" onClick={signOut}>
            Cerrar Sesión
          </Button>
        </div>
      </header>

      <main style={{ marginTop: '20px' }}>
        <p>¡Sesión autenticada correctamente con Amazon Cognito!</p>
      </main>
    </View>
  )
}

export default withAuthenticator(App)