import axios from 'axios';
import FuelingPhotoCapture from '../components/FuelingPhotoCapture';

export default function FuelingPhoto() {
  return <FuelingPhotoCapture api={axios} />;
}
