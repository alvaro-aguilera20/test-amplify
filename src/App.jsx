import React, { useState, useEffect } from 'react';
import { withAuthenticator, Button, Heading, View, TextField, Card, Flex, Loader } from '@aws-amplify/ui-react';
import { get, post } from 'aws-amplify/api';

const formFields = {
  signIn: {
    username: {
      label: 'RUT',
      placeholder: 'Ingresa tu RUT (ej: 12345678-9)',
      isRequired: true,
    },
    password: {
      label: 'Contraseña',
      placeholder: 'Ingresa tu contraseña',
    }
  },
  signUp: {
    username: {
      label: 'RUT',
      placeholder: 'Ingresa tu RUT (ej: 12345678-9)',
      order: 1,
      isRequired: true,
    },
    email: {
      label: 'Correo Electrónico',
      placeholder: 'ejemplo@correo.com',
      order: 2,
      isRequired: true,
    },
    password: { order: 3 },
    confirm_password: { order: 4 }
  }
};

function App({ signOut, user }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [destinatarioRut, setDestinatarioRut] = useState('');
  const [monto, setMonto] = useState('');
  const [mensaje, setMensaje] = useState('');

  // 1. Obtener todos los usuarios y filtrar por el RUT / ID conectado
  const fetchUserProfile = async () => {
    setLoading(true);
    try {
      const restOperation = get({
        apiName: 'api-banco',
        path: '/users'
      });
      const { body } = await restOperation.response;
      const usersList = await body.json(); // Retorna un array de UserProfile

      // Buscamos coincidencia por el RUT ingresado en Cognito (o si es 'admin')
      const currentUser = usersList.find(
        (u) => u.rut === user?.username || u.name === user?.username || u.rut === 'admin'
      ) || usersList[0]; // Si no hace match estricto, muestra el primer usuario existente

      setProfile(currentUser);
    } catch (error) {
      console.error('Error al conectar con la API:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.username) {
      fetchUserProfile();
    }
  }, [user]);

  // 2. Realizar transferencia mapeando las llaves exactas que exige tu Lambda
  const handleTransfer = async (e) => {
    e.preventDefault();
    setMensaje('');

    try {
      const restOperation = post({
        apiName: 'api-banco',
        path: '/payments',
        options: {
          body: {
            amount: Number(monto),
            sender_rut: profile?.rut || user?.username,
            recipient_rut: destinatarioRut
          }
        }
      });
      const { body } = await restOperation.response;
      const result = await body.json();

      setMensaje(result.message || 'Pago registrado exitosamente');
      setDestinatarioRut('');
      setMonto('');
      fetchUserProfile();
    } catch (error) {
      console.error('Error al realizar transferencia:', error);
      setMensaje('Hubo un problema al procesar la transferencia.');
    }
  };

  return (
    <View style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #ccc', paddingBottom: '10px' }}>
        <Heading level={2}>Banco Serverless</Heading>
        <div>
          <span style={{ marginRight: '15px' }}>
            Usuario conectado: <strong>{user?.username}</strong>
          </span>
          <Button variation="link" onClick={signOut}>
            Cerrar Sesión
          </Button>
        </div>
      </header>

      <main style={{ marginTop: '20px' }}>
        {loading ? (
          <Loader />
        ) : (
          <Flex direction="column" gap="1rem">
            {/* Tarjeta con los campos reales de MySQL: name, balance, rut, email */}
            <Card variation="bordered">
              <Heading level={4}>Mi Cuenta (Datos MySQL)</Heading>
              <p><strong>Nombre / Titular:</strong> {profile?.name || 'N/A'}</p>
              <p><strong>RUT:</strong> {profile?.rut || 'N/A'}</p>
              <p><strong>Email:</strong> {profile?.email || 'N/A'}</p>
              <p><strong>Rol:</strong> {profile?.role || 'Cliente'}</p>
              <p><strong>Saldo Disponible (Balance):</strong> ${Number(profile?.balance || 0).toLocaleString('es-CL')}</p>
            </Card>

            {/* Formulario de Pago */}
            <Card variation="bordered">
              <Heading level={4}>Realizar Transferencia</Heading>
              <form onSubmit={handleTransfer} style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '10px' }}>
                <TextField
                  label="RUT Destinatario (recipient_rut)"
                  placeholder="Ej: 98765432-1"
                  value={destinatarioRut}
                  onChange={(e) => setDestinatarioRut(e.target.value)}
                  isRequired
                />
                <TextField
                  label="Monto ($)"
                  type="number"
                  placeholder="10000"
                  value={monto}
                  onChange={(e) => setMonto(e.target.value)}
                  isRequired
                />
                <Button type="submit" variation="primary">
                  Transferir
                </Button>
              </form>
              {mensaje && <p style={{ marginTop: '10px', color: mensaje.includes('exitosamente') ? 'green' : 'red' }}>{mensaje}</p>}
            </Card>
          </Flex>
        )}
      </main>
    </View>
  );
}

export default withAuthenticator(App, { formFields });