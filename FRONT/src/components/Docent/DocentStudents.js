import React, { useState } from 'react';
import DocentStudentManagement from "./../Docent/DocentStudentManagement"; // Importar el componente de gestión de estudiantes

const DocentStudents = () => {
  // Este componente ahora solo renderiza DocentStudentManagement
  // La lógica de gestión de estudiantes se ha movido a DocentStudentManagement
  return <DocentStudentManagement />;
};

export default DocentStudents;