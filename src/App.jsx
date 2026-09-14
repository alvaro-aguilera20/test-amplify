import React, { useState, useEffect } from 'react';
import { withAuthenticator, Button, Heading, View, TextField, Card, Flex, Loader, Table, TableHead, TableRow, TableCell, TableBody, Badge, Alert } from '@aws-amplify/ui-react';
import { get, post, put } from 'aws-amplify/api';

const formFields = {
  signIn: {
    username: { label: 'RUT', placeholder: 'Ingresa tu RUT (ej: 20843519-2)', isRequired: true },
    password: { label: 'Contraseña', placeholder: 'Ingresa tu contraseña' }
  },
  signUp: {
    username: { label: 'RUT', placeholder: 'Ingresa tu RUT (ej: 20843519-2)', order: 1, isRequired: true },
    email: { label: 'Correo Electrónico', placeholder: 'ejemplo@correo.com', order: 2, isRequired: true },
    password: { order: 3 },
    confirm_password: { order: 4 }
  }
};

function App({ signOut, user }) {
  const [profile, setProfile] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [userPayments, setUserPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Estados para formulario de transferencia
  const [destinatarioRut, setDestinatarioRut] = useState('');
  const [monto, setMonto] = useState('');
  const [mensaje, setMensaje] = useState('');

  // Estados para edición de nombre
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [editandoNombre, setEditandoNombre] = useState(false);

  // 1. Cargar datos desde MySQL
  const fetchData = async () => {
    setLoading(true);
    try {
      // Obtener usuarios
      const usersOp = get({ apiName: 'api-banco', path: '/users' });
      const usersRes = await (await usersOp.response).body.json();
      setAllUsers(usersRes);

      const currentUsername = user?.username?.toString().trim();
      let currentUser = usersRes.find((u) => u.rut?.toString().trim() === currentUsername);

      // Si no existe en MySQL, crearlo vía POST /users
      if (!currentUser) {
        const createOp = post({
          apiName: 'api-banco',
          path: '/users',
          options: {
            body: {
              rut: currentUsername,
              email: user?.signInDetails?.loginId || `${currentUsername}@banco.cl`,
              name: `Cliente ${currentUsername}`,
              initial_balance: 100000
            }
          }
        });
        await createOp.response;
        
        // Volver a consultar la lista actualizada
        const reloadUsersOp = get({ apiName: 'api-banco', path: '/users' });
        const reloadedList = await (await reloadUsersOp.response).body.json();
        setAllUsers(reloadedList);
        currentUser = reloadedList.find((u) => u.rut?.toString().trim() === currentUsername);
      }

      setProfile(currentUser);

      // Cargar transferencias si está aprobado o es admin
      if (currentUser?.is_approved || currentUser?.role === 'ADMIN' || currentUsername === 'admin') {
        const paymentsOp = get({
          apiName: 'api-banco',
          path: `/payments?rut=${currentUsername}`
        });
        const paymentsRes = await (await paymentsOp.response).body.json();
        setUserPayments(paymentsRes);
      }

    } catch (error) {
      console.error('Error al obtener datos:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.username) {
      fetchData();
    }
  }, [user]);

  // 2. Editar Nombre propio
  const handleUpdateName = async (e) => {
    e.preventDefault();
    if (!nuevoNombre.trim()) return;

    try {
      const updateOp = put({
        apiName: 'api-banco',
        path: '/users',
        options: {
          body: {
            rut: profile?.rut || user?.username,
            name: nuevoNombre.trim()
          }
        }
      });
      await updateOp.response;
      setEditandoNombre(false);
      fetchData();
    } catch (error) {
      console.error('Error al actualizar nombre:', error);
    }
  };

  // 3. Realizar Transferencia
  const handleTransfer = async (e) => {
    e.preventDefault();
    setMensaje('');

    try {
      const restOp = post({
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
      const { body } = await restOp.response;
      const result = await body.json();

      setMensaje(result.message || 'Transferencia procesada.');
      setDestinatarioRut('');
      setMonto('');
      fetchData();
    } catch (error) {
      console.error('Error al transferir:', error);
      setMensaje('Error al procesar la transferencia.');
    }
  };

  // 4. Admin: Aprobar/Desaprobar Usuarios
  const handleToggleApproval = async (targetRut, currentStatus) => {
    try {
      const updateOp = put({
        apiName: 'api-banco',
        path: '/users',
        options: {
          body: {
            rut: targetRut,
            is_approved: !currentStatus
          }
        }
      });
      await updateOp.response;
      fetchData();
    } catch (error) {
      console.error('Error al actualizar aprobación:', error);
    }
  };

  const isAdmin = profile?.role === 'ADMIN' || user?.username === 'admin';
  const isApproved = Boolean(profile?.is_approved) || isAdmin;

  // -------------------------------------------------------------
  // PANTALLA 1: Bloqueo para usuario NO APROBADO
  // -------------------------------------------------------------
  if (!loading && !isApproved) {
    return (
      <View style={{ padding: '40px', maxWidth: '600px', margin: '100px auto', textAlign: 'center' }}>
        <Card variation="bordered" style={{ backgroundColor: '#fff8f0' }}>
          <Heading level={2} style={{ color: '#d97706' }}>Acceso Restringido</Heading>
          <Alert variation="warning" style={{ marginTop: '20px' }}>
            Tu cuenta (RUT: <strong>{user?.username}</strong>) está creada pero se encuentra <strong>pendiente de aprobación por un administrador</strong>.
          </Alert>
          <p style={{ marginTop: '20px', color: '#666' }}>
            No podrás acceder a las funciones de transferencia ni consultar saldos hasta que un Administrador apruebe tu perfil.
          </p>
          <Flex justifyContent="center" marginTop="30px">
            <Button variation="primary" onClick={fetchData}>Comprobar estado</Button>
            <Button variation="link" onClick={signOut}>Cerrar Sesión</Button>
          </Flex>
        </Card>
      </View>
    );
  }

  // -------------------------------------------------------------
  // PANTALLA 2: Usuario APROBADO o ADMIN
  // -------------------------------------------------------------
  return (
    <View style={{ padding: '20px', maxWidth: '1000px', margin: '0 auto' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #ccc', paddingBottom: '10px' }}>
        <Heading level={2}>Banco Serverless</Heading>
        <Flex alignItems="center">
          <span>Usuario: <strong>{user?.username}</strong></span>
          <Button variation="link" onClick={signOut}>Cerrar Sesión</Button>
        </Flex>
      </header>

      <main style={{ marginTop: '20px' }}>
        {loading ? (
          <Loader />
        ) : (
          <Flex direction="column" gap="1.5rem">
            
            {/* Tarjeta de Perfil */}
            <Card variation="bordered">
              <Heading level={4}>Mi Cuenta</Heading>
              
              {!editandoNombre ? (
                <Flex alignItems="center" gap="1rem" marginTop="10px">
                  <p><strong>Titular:</strong> {profile?.name || 'N/A'}</p>
                  <Button size="small" onClick={() => { setNuevoNombre(profile?.name || ''); setEditandoNombre(true); }}>
                    Editar Nombre
                  </Button>
                </Flex>
              ) : (
                <form onSubmit={handleUpdateName} style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '10px' }}>
                  <TextField 
                    label="Nuevo Nombre" 
                    value={nuevoNombre} 
                    onChange={(e) => setNuevoNombre(e.target.value)} 
                    isRequired 
                  />
                  <Button type="submit" variation="primary" size="small">Guardar</Button>
                  <Button variation="link" size="small" onClick={() => setEditandoNombre(false)}>Cancelar</Button>
                </form>
              )}

              <p style={{ marginTop: '8px' }}><strong>RUT:</strong> {profile?.rut || 'N/A'}</p>
              <p><strong>Saldo:</strong> ${Number(profile?.balance || 0).toLocaleString('es-CL')}</p>
              <p><strong>Estado:</strong> <Badge variation="success">Aprobado</Badge></p>
            </Card>

            {/* Formulario de Transferencia */}
            <Card variation="bordered">
              <Heading level={4}>Realizar Transferencia</Heading>
              <form onSubmit={handleTransfer} style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
                <TextField label="RUT Destinatario" value={destinatarioRut} onChange={(e) => setDestinatarioRut(e.target.value)} isRequired />
                <TextField label="Monto ($)" type="number" value={monto} onChange={(e) => setMonto(e.target.value)} isRequired />
                <Button type="submit" variation="primary">Transferir</Button>
              </form>
              {mensaje && <p style={{ marginTop: '10px' }}>{mensaje}</p>}
            </Card>

            {/* Historial de Transferencias */}
            <Card variation="bordered">
              <Heading level={4}>Mi Historial de Movimientos</Heading>
              {userPayments.length === 0 ? (
                <p style={{ marginTop: '10px' }}>No registras transferencias aún.</p>
              ) : (
                <Table highlightOnHover marginTop="10px">
                  <TableHead>
                    <TableRow>
                      <TableCell as="th">ID</TableCell>
                      <TableCell as="th">Origen</TableCell>
                      <TableCell as="th">Destino</TableCell>
                      <TableCell as="th">Monto</TableCell>
                      <TableCell as="th">Estado</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {userPayments.map((p) => {
                      const esEnviado = p.sender_rut === profile?.rut;
                      return (
                        <TableRow key={p.id}>
                          <TableCell>{p.id}</TableCell>
                          <TableCell>{p.sender_rut}</TableCell>
                          <TableCell>{p.recipient_rut}</TableCell>
                          <TableCell style={{ color: esEnviado ? 'red' : 'green', fontWeight: 'bold' }}>
                            {esEnviado ? `- $${Number(p.amount).toLocaleString('es-CL')}` : `+ $${Number(p.amount).toLocaleString('es-CL')}`}
                          </TableCell>
                          <TableCell><Badge variation="success">{p.status}</Badge></TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </Card>

            {/* Panel de Control Admin */}
            {isAdmin && (
              <Card variation="bordered" style={{ backgroundColor: '#f4f6f8' }}>
                <Heading level={4}>Panel de Control Admin (Gestión de Cuentas)</Heading>
                <Table highlightOnHover marginTop="10px">
                  <TableHead>
                    <TableRow>
                      <TableCell as="th">RUT</TableCell>
                      <TableCell as="th">Nombre</TableCell>
                      <TableCell as="th">Saldo</TableCell>
                      <TableCell as="th">Estado</TableCell>
                      <TableCell as="th">Acción</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {allUsers.map((u) => (
                      <TableRow key={u.rut}>
                        <TableCell>{u.rut}</TableCell>
                        <TableCell>{u.name}</TableCell>
                        <TableCell>${Number(u.balance).toLocaleString('es-CL')}</TableCell>
                        <TableCell>{u.is_approved ? <Badge variation="success">Aprobado</Badge> : <Badge variation="warning">Sin Aprobar</Badge>}</TableCell>
                        <TableCell>
                          <Button 
                            size="small" 
                            variation={u.is_approved ? "warning" : "primary"}
                            onClick={() => handleToggleApproval(u.rut, u.is_approved)}
                          >
                            {u.is_approved ? 'Desaprobar' : 'Aprobar'}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            )}

          </Flex>
        )}
      </main>
    </View>
  );
}

export default withAuthenticator(App, { formFields });